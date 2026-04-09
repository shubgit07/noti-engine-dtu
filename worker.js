/**
 * DTU Notices Proxy — Cloudflare Worker
 *
 * What changed vs original:
 *  - Added ctx parameter → enables ctx.waitUntil() for async cache writes
 *  - Added caches.default server-side cache (5 min TTL)
 *    First request in any 5-min window: fetches DTU, stores in CF edge cache
 *    All subsequent requests: served from CF edge cache (0 DTU network hit)
 *  - X-Cache: HIT / MISS header so you can verify cache behaviour
 */

const CACHE_TTL = 300;          // 5 minutes — matches frontend TTL
const CACHE_KEY = new Request("https://dtu-notices-html-cache/v3");

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://noti-engine-dtu.vercel.app",
];

function corsOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.find(o => origin.startsWith(o)) || ALLOWED_ORIGINS[1];
}

function isAllowed(request) {
  const origin  = request.headers.get("Origin")  || "";
  const referer = request.headers.get("Referer") || "";
  return (
    ALLOWED_ORIGINS.some(o => origin.startsWith(o)) ||
    ALLOWED_ORIGINS.some(o => referer.startsWith(o))
  );
}

export default {
  async fetch(request, env, ctx) {

    // ── Method guard ────────────────────────────────────────────────
    if (request.method !== "GET" && request.method !== "OPTIONS") {
      return new Response("Method not allowed", { status: 405 });
    }

    // ── Origin guard ────────────────────────────────────────────────
    if (!isAllowed(request)) {
      return new Response("Forbidden", { status: 403 });
    }

    const origin = corsOrigin(request);

    // ── CORS preflight ──────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin":  origin,
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age":       "86400",
        },
      });
    }

    // ── Server-side edge cache check ────────────────────────────────
    const cache  = caches.default;
    const cached = await cache.match(CACHE_KEY);

    if (cached) {
      // Serve from edge cache — zero DTU network hit
      const html = await cached.text();
      return new Response(html, {
        headers: {
          "Content-Type":             "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": origin,
          "Cache-Control":            `s-maxage=${CACHE_TTL}`,
          "X-Cache":                  "HIT",
          "X-Content-Type-Options":   "nosniff",
        },
      });
    }

    // ── Cache miss: fetch from DTU ──────────────────────────────────
    try {
      const res = await fetch("https://www.dtu.ac.in", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
      });

      if (!res.ok) {
        return new Response("Upstream error", { status: 502 });
      }

      const html = await res.text();

      // Store in edge cache asynchronously (doesn't block the response)
      ctx.waitUntil(
        cache.put(
          CACHE_KEY,
          new Response(html, {
            headers: {
              "Content-Type":  "text/html; charset=utf-8",
              "Cache-Control": `public, max-age=${CACHE_TTL}`,
            },
          })
        )
      );

      return new Response(html, {
        headers: {
          "Content-Type":             "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": origin,
          "Cache-Control":            `s-maxage=${CACHE_TTL}`,
          "X-Cache":                  "MISS",
          "X-Content-Type-Options":   "nosniff",
        },
      });

    } catch {
      return new Response("Service unavailable", { status: 503 });
    }
  },
};
