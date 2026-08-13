import { onRequest, onScheduled } from "../functions/api/[[path]].js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const routeVersion = "20260811-main-redesign-v21-worker";

    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n\nSitemap: https://ga-pick.com/sitemap.xml\n", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    if (url.pathname === "/sitemap.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ga-pick.com/</loc>
    <lastmod>2026-08-04</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://ga-pick.com/quote</loc>
    <lastmod>2026-08-04</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://ga-pick.com/my-quote</loc>
    <lastmod>2026-08-04</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://ga-pick.com/brand</loc>
    <lastmod>2026-08-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://ga-pick.com/seller</loc>
    <lastmod>2026-08-04</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://ga-pick.com/seller/register</loc>
    <lastmod>2026-08-04</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`,
        {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }

    if (url.pathname.startsWith("/api/")) {
      return onRequest({
        request,
        env,
        ctx,
        params: {
          path: url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean),
        },
      });
    }

    const normalizedPath = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";

    const standaloneRoutes = new Map([
      ["/brand", "/brand/index.html"],
      ["/brand/index.html", "/brand/index.html"],
    ]);
    if (standaloneRoutes.has(normalizedPath)) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = standaloneRoutes.get(normalizedPath);
      const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: "GET", headers: request.headers, redirect: "manual" }));
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      headers.set("X-GA-Pick-Route-Version", routeVersion);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    const appRoutes = new Set(["/", "/index.html", "/quote", "/my-quote", "/seller", "/seller/register"]);
    if (appRoutes.has(normalizedPath)) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/index.html";
      const assetRequest = new Request(indexUrl.toString(), {
        method: "GET",
        headers: request.headers,
        redirect: "manual",
      });
      const response = await env.ASSETS.fetch(assetRequest);
      if (response.status >= 300 && response.status < 400) {
        return new Response("Application shell routing error", {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-GA-Pick-Asset-Redirect": response.headers.get("Location") || "unknown",
          },
        });
      }
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      headers.set("X-GA-Pick-Route-Version", routeVersion);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(onScheduled({ event, env, ctx }));
  },
};
