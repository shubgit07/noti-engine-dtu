# DTU Notices Dashboard — Technical Architecture

## The Full Data Pipeline

```
Browser (React SPA)
    │
    │  1. Page loads → useEffect fires load()
    │
    ▼
fetchNotices(force=false)          ← utils.js
    │
    ├─── Cache check ────────────────────────────────────────────┐
    │    _cache !== null                                          │
    │    && Date.now() - _cacheTime < 300_000ms (5 min)         │
    │    && force === false                                       │
    │                                          YES → return _cache instantly
    │                                          NO  ↓
    │
    ▼
fetch("https://corsproxy.io/?url=https%3A%2F%2Fwww.dtu.ac.in")
    │
    │  WHY corsproxy.io?
    │  DTU's server does not send: Access-Control-Allow-Origin: *
    │  So the browser's same-origin policy blocks the request.
    │  corsproxy.io fetches DTU's HTML server-side and relays it
    │  back with proper CORS headers. We're an intermediary client.
    │
    ▼
Raw HTML string (~200–400 KB, the full DTU homepage)
    │
    ▼
DOMParser.parseFromString(html, "text/html")
    │  Creates a full in-memory DOM — NOT rendered on screen.
    │  This is a browser-native API, zero third-party libraries.
    │
    ▼
doc.querySelector("#tab4")
    │
    │  WHY #tab4?
    │  DTU's homepage has a tabbed section:
    │    #tab1 → Notices
    │    #tab2 → Jobs
    │    #tab3 → Tenders
    │    #tab4 → Latest News   ← we want this
    │    #tab5 → Forthcoming Events
    │
    ▼
tab4.querySelectorAll("li")   → iterate every list item
    │
    │  Each <li> looks like:
    │  <li>
    │    <h6>
    │      <a class="colr" href="./Web/upload/notice/2026/apr/file.pdf">
    │        Notice title text here
    │      </a>
    │      <br>
    │      <small><em> Date:<i>08.04.2026</i></em></small>
    │    </h6>
    │  </li>
    │
    ├── anchor  = li.querySelector("a.colr")   → title + href
    ├── dateEl  = li.querySelector("small em i") → "08.04.2026"
    ├── parseDate("08.04.2026")  → new Date(2026, 3, 8)
    ├── categorise(title)        → keyword match → "exam" | "acad" | ...
    └── examSubCat(title)        → "seating" | "datesheet" | "other"
    │
    ▼
notices[] — array of plain JS objects:
    [
      {
        id:      0,
        title:   "Seating Plan for B.Tech 6th Sem Examination",
        href:    "https://www.dtu.ac.in/Web/upload/notice/2026/apr/file.pdf",
        rawDate: "08.04.2026",
        dateObj: Date object,
        cat:     "exam"
      },
      ...
    ]
    │
    ├── _cache     = notices     ← stored in module-level variable
    └── _cacheTime = Date.now()  ← timestamp for TTL check
```

---

## How React Displays It

```
App.jsx (root component)
│
├── useState: notices[]       ← full parsed array (30–80 items typically)
├── useState: filter          ← "all" | "exam" | "acad" | ...
├── useState: query           ← search string
├── useState: sort            ← "desc" | "asc"
├── useState: page            ← current page multiplier (starts at 1)
│
├── useMemo: filtered[]
│   notices
│     → filter by cat (if filter !== "all")
│     → filter by query (title.toLowerCase().includes(q))
│     → sort by dateObj.getTime()
│   Result: full filtered+sorted array, NOT paginated
│
├── useMemo: visible[]
│   filtered.slice(0, page * 10)
│   │
│   └── Only these items go into the DOM.
│       page=1 → items 0–9  (10 nodes)
│       page=2 → items 0–19 (20 nodes)
│       etc.
│
├── useMemo: examNotices[]
│   notices.filter(n => n.cat === "exam")
│   → passed to <ExamBoard> separately
│
└── useEffect([filter, query, sort])
    setPage(1)   ← resets to 10 whenever results change
```

---

## Memory Model

```
Module scope (utils.js)          React state (App.jsx)
─────────────────────            ──────────────────────────────────────────
_cache = [...notices]    ──▶     notices[]  (same reference, not copied)
_cacheTime = 1712600000          filtered[] (derived, new array each time)
                                 visible[]  (slice of filtered, 10 items)

DOM nodes actually rendered:
  visible.length notices × 1 <a> card each → typically 10 DOM nodes
  ExamBoard: all exam notices in a scrollable list (separate section)
```

---

## What DTU's Site Actually Has vs What We Show

| | DTU Website | Our Dashboard |
|---|---|---|
| Items in `#tab4` | ~30–80 (varies) | Same source |
| Shown by default | All at once (no pagination) | **10** |
| User can get more | Must go to site | **Load More** (+10 each time) |
| Category filters | None | 8 categories |
| Search | None | Real-time keyword filter |
| Seating plans | Mixed with everything | Dedicated Exam Board panel |

---

## Cache Lifecycle

```
t=0        User opens page
             → fetchNotices(force=false)
             → _cache = null, so real fetch fires
             → ~1–3 sec (network + parse)
             → _cache set, _cacheTime = t

t=30s      User clicks Refresh button
             → fetchNotices(force=true)
             → IGNORES cache, real fetch fires again

t=2min     User changes filter tab
             → NO fetch. React re-runs useMemo on existing notices[].
             → Sub-millisecond.

t=5min     User clicks Refresh button again
             → Cache TTL expired anyway,
             → fresh fetch regardless of force flag

t=5min+1s  User opens dashboard in new tab
             → New JS module scope → _cache = null
             → Fresh fetch (module state is not shared across tabs)
```

---

## Why This Approach, Not Others

| Option | Why NOT |
|---|---|
| DTU API with pagination | DTU has no public API. HTML only. |
| Scraping more tabs (#tab1 Notices) | Could do it — but doubles fetch size, same single HTML file |
| Backend proxy server | Overkill for a read-only dashboard. Adds infra cost. |
| Service Worker cache | Good for offline, but adds complexity. TTL in module is sufficient here. |
| Virtual scrolling (react-window) | Only needed at 500+ items. We have ~80 max. |
| localStorage cache | Persists across tabs/sessions — could serve stale data. Module scope is safer. |

---

## Key Files

| File | Role |
|---|---|
| `src/utils.js` | Fetch, parse, cache, categorise, date format |
| `src/App.jsx` | State, filtering, pagination, orchestration |
| `src/ExamBoard.jsx` | Exam sub-section with seating/datesheet split |
| `src/NoticeCard.jsx` | Single notice card render |
| `src/FilterBar.jsx` | Category filter buttons |
