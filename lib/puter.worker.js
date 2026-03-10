const PROJECT_PREFIX = "roomify_project_";
const PUBLIC_SHARE_PREFIX = "roomify_public_share_";
const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization", "puter-auth"];

const getCorsHeaders = (request) => {
  const requestedHeaders = request?.headers?.get("Access-Control-Request-Headers");
  const allowHeaders = requestedHeaders
    ? Array.from(
        new Set([
          ...DEFAULT_ALLOWED_HEADERS,
          ...requestedHeaders
            .split(",")
            .map((header) => header.trim())
            .filter(Boolean),
        ]),
      ).join(", ")
    : DEFAULT_ALLOWED_HEADERS.join(", ");

  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": allowHeaders,
    Vary: "Access-Control-Request-Headers",
  };
};

const jsonResponse = (status, body, request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(request),
    },
  });

const jsonError = (status, message, request, extra = {}) =>
  jsonResponse(status, { error: message, ...extra }, request);

const preflight = ({ request }) =>
  new Response(null, { status: 204, headers: getCorsHeaders(request) });

const getUserId = async (userPuter) => {
  try {
    const user = await userPuter.auth.getUser();
    return user?.uuid || null;
  } catch {
    return null;
  }
};

const getUserProfile = async (userPuter) => {
  try {
    const user = await userPuter.auth.getUser();
    return {
      userId: user?.uuid || null,
      userName: user?.username || user?.email || null,
    };
  } catch {
    return {
      userId: null,
      userName: null,
    };
  }
};

const createShareId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
};

const getProjectKey = (projectId) => `${PROJECT_PREFIX}${projectId}`;
const getShareKey = (shareId) => `${PUBLIC_SHARE_PREFIX}${shareId}`;
const getPublicPath = (shareId) => `/share/${shareId}`;

const getShareIdFromPath = (publicPath) => {
  if (typeof publicPath !== "string" || !publicPath) return null;

  try {
    const normalized = publicPath.startsWith("http")
      ? new URL(publicPath).pathname
      : publicPath;

    const match = normalized.match(/^\/share\/([^/?#]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
};

const sanitizeProjectForShare = (project) => {
  if (!project?.id || !project?.sourceImage) return null;

  return {
    id: project.id,
    name: project.name ?? null,
    sourceImage: project.sourceImage,
    renderedImage: project.renderedImage ?? null,
    timestamp: typeof project.timestamp === "number" ? project.timestamp : Date.now(),
    publicPath: project.publicPath ?? null,
    ownerId: project.ownerId ?? null,
    sharedBy: project.sharedBy ?? null,
    sharedAt: project.sharedAt ?? null,
    isPublic: Boolean(project.isPublic),
  };
};

router.post("/api/projects/save", async ({ request, user }) => {
  try {
    const userPuter = user?.puter;
    if (!userPuter) return jsonError(401, "Authentication Failed", request);

    const body = await request.json();
    const project = body?.project;

    if (!project?.id || !project?.sourceImage) {
      return jsonError(400, "Project payload is invalid", request);
    }

    const userId = await getUserId(userPuter);
    if (!userId) return jsonError(401, "Authentication Failed", request);

    const payload = {
      ...project,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
    };

    const key = getProjectKey(project.id);
    await userPuter.kv.set(key, payload);

    return jsonResponse(200, { saved: true, id: project.id, project: payload }, request);
  } catch (error) {
    return jsonError(500, "Failed to save project", request, {
      message: error?.message || "Unknown error",
    });
  }
});

const normalizeListKeys = (result) => {
  if (Array.isArray(result)) {
    return result
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.key === "string") return entry.key;
        return null;
      })
      .filter(Boolean);
  }

  if (result && Array.isArray(result.keys)) return result.keys;
  if (result && Array.isArray(result.items)) {
    return result.items
      .map((entry) => (entry && typeof entry.key === "string" ? entry.key : null))
      .filter(Boolean);
  }

  return [];
};

router.get("/api/projects/list", async ({ request, user }) => {
  const userPuter = user?.puter;
  if (!userPuter) return jsonError(401, "Authentication Failed", request);

  try {
    const listResult = await userPuter.kv.list({ prefix: PROJECT_PREFIX });
    const keys = normalizeListKeys(listResult).filter((key) =>
      key.startsWith(PROJECT_PREFIX),
    );

    const values = await Promise.all(keys.map((key) => userPuter.kv.get(key)));
    const projects = values.filter((value) => value != null);

    return jsonResponse(200, { projects }, request);
  } catch (error) {
    return jsonError(500, "Failed to list projects", request, {
      message: error?.message || "Unknown error",
    });
  }
});

router.get("/api/projects/get", async ({ request, user }) => {
  const userPuter = user?.puter;
  if (!userPuter) return jsonError(401, "Authentication Failed", request);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) return jsonError(400, "Missing project id", request);

    const key = getProjectKey(id);
    const project = await userPuter.kv.get(key);

    return jsonResponse(200, { project: project ?? null }, request);
  } catch (error) {
    return jsonError(500, "Failed to fetch project", request, {
      message: error?.message || "Unknown error",
    });
  }
});

router.post("/api/projects/share", async ({ request, user }) => {
  const userPuter = user?.puter;
  if (!userPuter) return jsonError(401, "Authentication Failed", request);

  try {
    const url = new URL(request.url);
    let body = null;

    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const projectId =
      url.searchParams.get("id") ||
      body?.projectId ||
      body?.id ||
      null;

    if (!projectId || typeof projectId !== "string") {
      return jsonError(400, "Missing project id", request);
    }

    const key = getProjectKey(projectId);
    const existingProject = await userPuter.kv.get(key);

    if (!existingProject?.id || !existingProject?.sourceImage) {
      return jsonError(404, "Project not found", request);
    }

    if (!existingProject?.renderedImage) {
      return jsonError(400, "Project must be rendered before sharing", request);
    }

    const { userId, userName } = await getUserProfile(userPuter);
    if (!userId) return jsonError(401, "Authentication Failed", request);

    const existingShareId = getShareIdFromPath(existingProject.publicPath);
    const shareId = existingShareId || createShareId();
    const publicPath = getPublicPath(shareId);
    const sharedAt = existingProject.sharedAt || new Date().toISOString();
    const sharedBy = existingProject.sharedBy || userName || userId;

    const project = {
      ...existingProject,
      ownerId: userId,
      publicPath,
      sharedAt,
      sharedBy,
      isPublic: true,
      updatedAt: new Date().toISOString(),
    };

    const publicProject = sanitizeProjectForShare(project);
    if (!publicProject) {
      return jsonError(500, "Failed to build public project", request);
    }

    const shareRecord = {
      shareId,
      projectId: project.id,
      ownerId: userId,
      publicPath,
      sharedAt,
      sharedBy,
      project: publicProject,
    };

    await userPuter.kv.set(key, project);
    await me.puter.kv.set(getShareKey(shareId), shareRecord);

    return jsonResponse(
      200,
      {
        shareId,
        publicPath,
        project,
      },
      request,
    );
  } catch (error) {
    return jsonError(500, "Failed to create share link", request, {
      message: error?.message || "Unknown error",
    });
  }
});

router.get("/api/projects/public", async ({ request }) => {
  try {
    const url = new URL(request.url);
    const shareId = url.searchParams.get("id");

    if (!shareId) return jsonError(400, "Missing share id", request);

    const shareRecord = await me.puter.kv.get(getShareKey(shareId));
    const project = sanitizeProjectForShare(shareRecord?.project);

    if (!project?.id) {
      return jsonError(404, "Shared project not found", request);
    }

    return jsonResponse(200, { project }, request);
  } catch (error) {
    return jsonError(500, "Failed to fetch shared project", request, {
      message: error?.message || "Unknown error",
    });
  }
});

router.options("/api/projects/save", preflight);
router.options("/api/projects/list", preflight);
router.options("/api/projects/get", preflight);
router.options("/api/projects/share", preflight);
router.options("/api/projects/public", preflight);
