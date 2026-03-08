const PROJECT_PREFIX = "roomify_project_";
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

    const key = `${PROJECT_PREFIX}${project.id}`;
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

    const key = `${PROJECT_PREFIX}${id}`;
    const project = await userPuter.kv.get(key);

    return jsonResponse(200, { project: project ?? null }, request);
  } catch (error) {
    return jsonError(500, "Failed to fetch project", request, {
      message: error?.message || "Unknown error",
    });
  }
});

router.options("/api/projects/save", preflight);
router.options("/api/projects/list", preflight);
router.options("/api/projects/get", preflight);
