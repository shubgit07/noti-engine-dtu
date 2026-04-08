# DTU Notices Dashboard

A fast, clean single-page dashboard that fetches and displays the **Latest News** section from [dtu.ac.in](https://www.dtu.ac.in) — with category filters, real-time search, and smart pagination.

---

## What It Does

- Fetches live notices from DTU's website via a CORS proxy (no backend needed)
- Auto-categorises every notice by keyword matching (Exams, Academic, Scholarships, Research, Events, etc.)
- Search, filter by category, sort by date, and paginate — all client-side, instant
- Caches results for 5 minutes so repeated visits don't re-hit the proxy

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 (no TypeScript) |
| Bundler | Vite |
| Styling | Plain CSS with CSS custom properties (`index.css`) |
| Data | DTU homepage HTML scraped via `corsproxy.io` |
| State | React `useState` / `useMemo` / `useCallback` — no Redux |

---

## Project Structure

```
src/
├── App.jsx          # Root component — state, filters, pagination, error handling
├── Navbar.jsx       # Top sticky navbar with Refresh button
├── FilterBar.jsx    # Category filter buttons with counts
├── NoticeCard.jsx   # Single notice card (title, date, category badge, link)
├── utils.js         # Fetch (proxy fallback), cache, categorise, date helpers
├── index.css        # All styles in one file, CSS variables throughout
└── main.jsx         # Entry point
```

---

## How Data Fetching Works

```
Browser → corsproxy.io → dtu.ac.in (HTML)
                              ↓
              DOMParser picks out #tab4 (Latest News tab)
                              ↓
              Each <li> → { title, href, date, category }
                              ↓
              Stored in module-level cache (5-min TTL)
```

**Proxy fallback chain** — if one proxy fails, automatically retries the next:
1. `corsproxy.io`
2. `api.allorigins.win`
3. `cors-anywhere.herokuapp.com`

**Error types surfaced to the user:**
- `PROXY_FAIL` — all proxies unreachable (DTU may be down)
- `PARSE_FAIL` — DTU's HTML structure has changed (logged to console)
- `NETWORK_FAIL` — general network issue

**Parse validation:** if fewer than 3 `<li>` items are found in `#tab4`, it's treated as a parse failure and the raw HTML is logged to the browser console for debugging.

---

## Display & Pagination

- **10 notices shown by default.** Click "Load more" to fetch the next 10.
- Filter, search, or sort → resets back to page 1 automatically.
- Search input is **debounced 300ms** — no jank while typing.
- **Refresh button** always forces a fresh network fetch (bypasses cache) and resets to page 1.
- Cache hits show ⚡ in the meta bar; fresh fetches show 🕐 with the time.

---

## Categories

| # | Category | Keywords matched |
|---|---|---|
| 🎓 | Examinations | exam, datesheet, mid-term, makeup, result, reappear |
| 📚 | Academic | marksheet, degree, admission, JAC, semester, course, AEC/VAC/FEC |
| 💰 | Scholarships | scholarship, fee concession, waiver, OBC/SC/EWS, stipend, fellowship |
| 🔬 | Research & PhD | PhD, thesis, research, viva, synopsis, publication |
| 👨‍💼 | Administration | APAR, staff, circular, coordinator, warden, office |
| 🎉 | Events | fest, seminar, MoU, convocation, workshop, ceremony |
| ⚽ | Sports | sports, tournament, athletic, championship |
| 📋 | General | anything that doesn't match the above |

Matching is case-insensitive and checks if the keyword appears anywhere in the notice title. First match wins, top-to-bottom.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build    # production bundle → dist/
npm run preview  # preview the production build locally
```

---

## Notes

- DTU has no public API — this app scrapes the homepage HTML. If DTU changes their page layout (specifically `#tab4`), check the browser console for the raw HTML dump and update the selectors in `utils.js → parseHTML()`.
- The CORS proxy is a public free service. For a production deployment, consider running your own proxy or a lightweight Cloudflare Worker.
- Cache is in-memory (module scope) — it resets on every page refresh and is not shared between tabs.
