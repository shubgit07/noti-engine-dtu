// ===== CONSTANTS =====
export const DTU_BASE = 'https://www.dtu.ac.in';
export const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ===== PROXY FALLBACK CHAIN =====
// Order matters — first healthy proxy wins.
// Each entry: { makeUrl, extractHtml }
//   makeUrl(url)     → the URL to fetch
//   extractHtml(res) → async fn that returns the raw HTML string from the response

const PROXIES = [
  {
    // Cloudflare worker — your own, most reliable for dtu.ac.in
    makeUrl:     (_url) => `https://dtu-proxy.bettermentorr.workers.dev`,
    extractHtml: (res) => res.text(),
  },
  {
    // corsproxy.io — free public proxy, fallback
    makeUrl:     (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    extractHtml: (res) => res.text(),
  },
  {
    // allorigins /get — returns JSON { contents, status }; last resort
    makeUrl:     (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    extractHtml: async (res) => {
      const json = await res.json();
      if (!json.contents) throw Object.assign(new Error('allorigins returned empty contents'), { code: 'PROXY_FAIL' });
      return json.contents;
    },
  },
];

// ===== CATEGORIES =====
export const CATEGORIES = {
  exam:   { label: 'Examinations',   emoji: '🎓', keys: ['exam','datesheet','mid-term','make up','makeup','result','reappear','backlog'] },
  acad:   { label: 'Academic',       emoji: '📚', keys: ['marksheet','degree','admission','jac','semester','course','aec','vac','fec','academic','curriculum','syllabus','timetable','time table','class','lecture'] },
  schol:  { label: 'Scholarships',   emoji: '💰', keys: ['scholarship','yasasvi','pm','obc','sc','stipend','fellowship','award','grant','financial','fee concession','concession','fee waiver','waiver','freeship','free ship','merit scholarship','bursary','financial aid','ews','economically weaker','tuition fee'] },
  res:    { label: 'Research & PhD', emoji: '🔬', keys: ['phd','thesis','research','r&d','project proposal','inventor','publication','citation','viva','synopsis','supervisor','research scholar'] },
  admin:  { label: 'Administration', emoji: '👨‍💼', keys: ['apar','staff','remuneration','ta','responsibility','coordinator','deputy','circular','obsolete','appointment','proctor','warden','office','administration'] },
  event:  { label: 'Events',         emoji: '🎉', keys: ['fest','cultural','function','ceremony','engifest','golden pride','mou','seminar','conference','workshop','webinar','symposium','convocation','inauguration'] },
  sports: { label: 'Sports',         emoji: '⚽', keys: ['sports','council','game','tournament','athletic','championship','league','match','cricket','football','basketball','badminton'] },
  gen:    { label: 'General',        emoji: '📋', keys: [] },
};

// ===== CATEGORISE =====
export function categorise(title) {
  const t = title.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (key === 'gen') continue;
    if (cat.keys.some(kw => t.includes(kw))) return key;
  }
  return 'gen';
}

// ===== EXAM SUB-CATEGORIES =====
const EXAM_SUB = {
  seating:   ['seating', 'seat plan', 'seating plan', 'seat arrangement', 'room allot'],
  datesheet: ['datesheet', 'date sheet', 'date-sheet', 'schedule of exam', 'examination schedule'],
  makeup:    ['makeup exam', 'make up exam', 'makeup', 'make up', 'detention list', 'detention', 'detain', 'detained'],
};

export function examSubCat(title) {
  const t = title.toLowerCase();
  for (const [key, keywords] of Object.entries(EXAM_SUB)) {
    if (keywords.some(kw => t.includes(kw))) return key;
  }
  return 'other';
}

// ===== SCHOLARSHIP SUB-CATEGORIES =====
const SCHOL_SUB = {
  concession: ['fee concession', 'concession', 'fee waiver', 'waiver', 'freeship', 'free ship', 'tuition fee', 'financial aid', 'ews'],
  scholarship: ['scholarship', 'stipend', 'fellowship', 'bursary', 'yasasvi', 'grant'],
  medal: ['award', 'awards', 'medal', 'medals', 'merit scholarship', 'merit'],
};

export function scholSubCat(title) {
  const t = title.toLowerCase();
  for (const [key, keywords] of Object.entries(SCHOL_SUB)) {
    if (keywords.some(kw => t.includes(kw))) return key;
  }
  return 'other';
}

// ===== DATE HELPERS =====
export function parseDate(raw) {
  if (!raw) return null;
  const parts = raw.trim().split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export function formatDate(dateObj) {
  if (!dateObj) return 'Date N/A';
  return `${String(dateObj.getDate()).padStart(2, '0')} ${MONTHS[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

export function isRecent(dateObj) {
  if (!dateObj) return false;
  return Date.now() - dateObj.getTime() < 7 * 24 * 60 * 60 * 1000;
}

// ===== IN-MEMORY CACHE (5-min TTL) =====
let _htmlCache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// ===== SECURITY HELPERS =====

/**
 * Strip all HTML tags and kill javascript: URIs from a string.
 * Protects against injected markup if a proxy ever MITMs the response.
 */
function sanitiseText(str) {
  return str
    .replace(/<[^>]*>/g, '')       // strip any HTML tags
    .replace(/javascript:/gi, '')  // neutralise js: URIs
    .trim();
}

/**
 * Only allow hrefs that resolve to *.dtu.ac.in.
 * Returns the original URL if safe, otherwise '#'.
 */
export function isSafeUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url, DTU_BASE);
    return parsed.hostname === 'dtu.ac.in' ||
           parsed.hostname.endsWith('.dtu.ac.in');
  } catch {
    return false;
  }
}

// ===== PARSE HELPER =====
function parseHTMLChunk(html, offset = 0, limit = 50) {
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  const tab4 = doc.querySelector('#tab4');

  if (!tab4) {
    console.error('[DTU] #tab4 not found. First 1000 chars of HTML:', html.slice(0, 1000));
    const err = new Error('Could not read DTU notices — site structure may have changed.');
    err.code  = 'PARSE_FAIL';
    throw err;
  }

  const items = tab4.querySelectorAll('li');
  if (items.length < 3) {
    console.error(`[DTU] Parse validation: only ${items.length} <li> in #tab4. #tab4 HTML:`, tab4.innerHTML);
    const err = new Error('Could not read DTU notices — site structure may have changed.');
    err.code  = 'PARSE_FAIL';
    throw err;
  }

  const total = items.length;
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  const start = Math.min(safeOffset, total);
  const end = Math.min(start + safeLimit, total);

  const notices = [];
  for (let idx = start; idx < end; idx++) {
    const li = items[idx];
    const anchor = li.querySelector('a.colr') || li.querySelector('a');
    if (!anchor) continue;

    // Sanitise: strip any injected HTML/JS from the text node
    const title = sanitiseText(anchor.textContent);
    if (!title) continue;

    // Resolve relative URLs then validate they point to *.dtu.ac.in
    let rawHref = anchor.getAttribute('href') || '';
    if (rawHref && !rawHref.startsWith('http')) {
      rawHref = DTU_BASE + (rawHref.startsWith('/') ? '' : '/') + rawHref.replace(/^\.\//, '');
    }
    const href = isSafeUrl(rawHref) ? rawHref : '#';

    const dateEl  = li.querySelector('small em i') || li.querySelector('i');
    const rawDate = dateEl ? dateEl.textContent.trim() : '';
    const dateObj = parseDate(rawDate);

    notices.push({ id: idx, title, href, rawDate, dateObj, cat: categorise(title) });
  }

  return {
    notices,
    total,
    nextOffset: end,
    hasMore: end < total,
  };
}

// ===== FETCH WITH PROXY FALLBACK CHAIN =====
export async function fetchNotices(options = {}) {
  const {
    force = false,
    offset = 0,
    limit = 50,
  } = typeof options === 'boolean' ? { force: options } : options;

  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 50;

  // Serve from cache if still fresh
  if (!force && _htmlCache && Date.now() - _cacheTime < CACHE_TTL) {
    const parsed = parseHTMLChunk(_htmlCache, safeOffset, safeLimit);
    return { ...parsed, fromCache: true };
  }

  let lastErrCode = 'PROXY_FAIL';
  let lastErrMsg  = 'All proxy servers failed. DTU may be down or unreachable.';

  for (const { makeUrl, extractHtml } of PROXIES) {
    const proxyUrl = makeUrl(DTU_BASE);
    try {
      const res = await fetch(proxyUrl, { cache: 'no-store' });

      if (!res.ok) {
        // Proxy responded but with an HTTP error — try next proxy
        console.warn(`[DTU] Proxy ${proxyUrl} returned HTTP ${res.status}`);
        lastErrCode = 'PROXY_FAIL';
        lastErrMsg  = `All proxy servers failed (last: HTTP ${res.status}).`;
        continue;
      }

      let html;
      try {
        html = await extractHtml(res);            // proxy-specific extraction
      } catch (extractErr) {
        console.warn(`[DTU] Proxy ${proxyUrl} extract error:`, extractErr.message);
        lastErrCode = 'PROXY_FAIL';
        lastErrMsg  = extractErr.message;
        continue;
      }

      try {
        const parsed = parseHTMLChunk(html, safeOffset, safeLimit); // throws PARSE_FAIL if invalid
        _htmlCache = html;
        _cacheTime = Date.now();
        return { ...parsed, fromCache: false };
      } catch (parseErr) {
        if (parseErr.code === 'PARSE_FAIL') {
          // DTU's structure changed — all proxies will give the same HTML, no point retrying
          throw parseErr;
        }
        throw parseErr;                            // unexpected error — propagate
      }

    } catch (err) {
      if (err.code === 'PARSE_FAIL') throw err;    // hard stop — not a proxy issue
      // Network error for this proxy — try next
      console.warn(`[DTU] Proxy ${proxyUrl} network error:`, err.message);
      lastErrCode = 'NETWORK_FAIL';
      lastErrMsg  = err.message;
    }
  }

  // All proxies exhausted
  const finalErr  = new Error(lastErrMsg);
  finalErr.code   = lastErrCode;
  throw finalErr;
}
