// ── Rate Limiter (per IP, in-memory per isolate) ──────────────────
const RATE_STORE  = new Map();  // ip → { count, windowStart }
const RL_MAX      = 20;         // max 20 requests per IP per minute
const RL_WINDOW   = 60_000;     // 1-minute sliding window

function isRateLimited(ip) {
  const now   = Date.now();
  const entry = RATE_STORE.get(ip);

  if (!entry || now - entry.windowStart > RL_WINDOW) {
    RATE_STORE.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RL_MAX) return true;
  entry.count++;
  return false;
}

// Prevent unbounded memory growth — prune stale IPs
function pruneRateStore() {
  const cutoff = Date.now() - RL_WINDOW * 2;
  for (const [ip, e] of RATE_STORE)
    if (e.windowStart < cutoff) RATE_STORE.delete(ip);
}

// ──────────────────────────────────────────────────────────────────
const CACHE_TTL = 300;
const CACHE_KEY = new Request("https://dtu-notices-html-cache/v3");

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://noticedce.vercel.app",
];

export default {
  async fetch(request, env, ctx) {

    // ── Method guard ───────────────────────────────────────────────
    if (request.method !== "GET" && request.method !== "OPTIONS") {
      return new Response("Method not allowed", { status: 405 });
    }

    // ── Origin guard ───────────────────────────────────────────────
    const origin  = request.headers.get("Origin")  || "";
    const referer = request.headers.get("Referer") || "";

    const isLegit =
      ALLOWED_ORIGINS.some(o => origin.startsWith(o)) ||
      ALLOWED_ORIGINS.some(o => referer.startsWith(o));

    if (!isLegit) {
      return new Response("Forbidden", { status: 403 });
    }

    const corsOrigin =
      ALLOWED_ORIGINS.find(o => origin.startsWith(o)) || ALLOWED_ORIGINS[1];

    // ── CORS preflight ─────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin":  corsOrigin,
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age":       "86400",
        },
      });
    }

    // ── Rate limit (per real client IP) ───────────────────────────
    // CF-Connecting-IP is injected by Cloudflare — cannot be spoofed
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    ctx.waitUntil(Promise.resolve().then(pruneRateStore));

    if (isRateLimited(clientIP)) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After":                 "60",
          "Access-Control-Allow-Origin": corsOrigin,
        },
      });
    }

    // ── Edge cache check (serves most requests, zero DTU hit) ──────
    const cache  = caches.default;
    const cached = await cache.match(CACHE_KEY);

    if (cached) {
      const html = await cached.text();
      return new Response(html, {
        headers: {
          "Content-Type":                "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": corsOrigin,
          "Cache-Control":               `s-maxage=${CACHE_TTL}`,
          "X-Cache":                     "HIT",
          "X-Content-Type-Options":      "nosniff",
        },
      });
    }

    // ── Cache miss: fetch from DTU ─────────────────────────────────
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

      // Store in edge cache async — does not delay the response
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
          "Content-Type":                "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": corsOrigin,
          "Cache-Control":               `s-maxage=${CACHE_TTL}`,
          "X-Cache":                     "MISS",
          "X-Content-Type-Options":      "nosniff",
        },
      });

    } catch {
      return new Response("Service unavailable", { status: 503 });
    }
  },
};
