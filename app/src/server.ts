import { geometryGateway } from './lib/geometry-gateway.server';
import { applySecurityHeaders } from "./lib/security-headers.server";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Life Lab's deterministic local simulation remains available.
// Remote inference is intentionally unavailable until a separately authenticated,
// budget-controlled provider integration is provisioned. No public endpoint may
// spend the owner's provider quota or forward visitor-authored prompts.
async function lifeBrain(request: Request): Promise<Response> {
  const headers = {"content-type":"application/json","cache-control":"no-store"};
  if (request.method === "GET") {
    return new Response(JSON.stringify({
      enabled:false,
      reason:"Remote AI is offline. The local simulation remains available."
    }), {headers});
  }
  return new Response(JSON.stringify({
    error:"Remote AI inference is not available on this public site."
  }), {status:request.method === "POST" ? 503 : 405, headers});
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if(new URL(request.url).pathname.startsWith("/api/native/"))return geometryGateway(request,env as Record<string,string|undefined>);
      if(new URL(request.url).pathname==="/api/life/think")return lifeBrain(request);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
