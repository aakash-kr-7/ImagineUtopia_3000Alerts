import { workspaceIdentity } from "./session";
import { handleApi } from "./api";
import { d1Store } from "./storage";
declare const __STATIC_ASSETS__: Record<string, { body: string; type: string }>;
interface Env {
  DB: D1Database;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const identity = await workspaceIdentity(request);
      if (!env.DB)
        return new Response(
          JSON.stringify({ error: "Persistent storage is unavailable." }),
          { status: 503, headers: { "content-type": "application/json" } },
        );
      const response = await handleApi(
        request,
        d1Store(env.DB),
        identity.owner,
      );
      if (identity.setCookie)
        response.headers.set("set-cookie", identity.setCookie);
      response.headers.set("x-frame-options", "DENY");
      return response;
    }
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method not allowed", { status: 405 });
    const asset =
      __STATIC_ASSETS__[url.pathname] ??
      (url.pathname.includes(".") ? null : __STATIC_ASSETS__["/"]);
    if (!asset) return new Response("Not found", { status: 404 });
    const bytes = Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0));
    return new Response(request.method === "HEAD" ? null : bytes, {
      headers: {
        "content-type": asset.type,
        "cache-control": url.pathname.startsWith("/assets/")
          ? "public,max-age=31536000,immutable"
          : "no-cache",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "content-security-policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; object-src 'none'",
      },
    });
  },
};
