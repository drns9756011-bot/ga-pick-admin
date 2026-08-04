import { onRequest, onScheduled } from "../functions/api/[[path]].js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const routeVersion = "20260804-visitor-stats-banner1";

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

    const appRoutes = new Set(["/", "/quote", "/my-quote", "/seller", "/seller/register"]);
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    if (appRoutes.has(normalizedPath)) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/index.html";
      const response = await env.ASSETS.fetch(new Request(indexUrl, request));
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

