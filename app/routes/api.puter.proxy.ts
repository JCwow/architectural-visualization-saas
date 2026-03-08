import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const PUTER_WORKER_URL = import.meta.env.VITE_PUTER_WORKER_URL || "";
const FORWARDED_HEADERS = ["content-type", "authorization", "puter-auth"] as const;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const buildWorkerUrl = (request: Request, splat?: string) => {
  if (!PUTER_WORKER_URL) return null;
  if (!splat) return null;

  const requestUrl = new URL(request.url);
  const target = new URL(`/api/${splat}`, PUTER_WORKER_URL);
  target.search = requestUrl.search;

  return target.toString();
};

const getForwardHeaders = (request: Request) => {
  const headers = new Headers();

  for (const headerName of FORWARDED_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  return headers;
};

const toProxyResponse = async (response: Response) => {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) headers.set("Content-Type", contentType);

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const proxyRequest = async (request: Request, splat?: string) => {
  const target = buildWorkerUrl(request, splat);

  if (!PUTER_WORKER_URL) {
    return jsonResponse(500, { error: "Missing VITE_PUTER_WORKER_URL" });
  }

  if (!target) {
    return jsonResponse(400, { error: "Missing worker path" });
  }

  const init: RequestInit = {
    method: request.method,
    headers: getForwardHeaders(request),
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(target, init);

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: "Upstream error",
        statusText: response.statusText,
        body: await response.text(),
      });
    }

    return toProxyResponse(response);
  } catch (error) {
    return jsonResponse(502, {
      error: "Upstream fetch failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const loader = async ({ request, params }: LoaderFunctionArgs) =>
  proxyRequest(request, params["*"]);

export const action = async ({ request, params }: ActionFunctionArgs) =>
  proxyRequest(request, params["*"]);
