import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Navbar     from './Navbar';
import FilterBar  from './FilterBar';
import NoticeCard from './NoticeCard';
import { fetchNotices, CATEGORIES } from './utils';

const PAGE_SIZE = 10;

// ===== COUNTS PER CATEGORY =====
function useCounts(notices) {
  return useMemo(() => {
    const counts = { all: notices.length };
    Object.keys(CATEGORIES).forEach(k => {
      counts[k] = notices.filter(n => n.cat === k).length;
    });
    return counts;
  }, [notices]);
}

// ===== FILTER + SORT (full result list, pagination slices it) =====
function useFiltered(notices, filter, query, sort) {
  return useMemo(() => {
    let list = notices;
    if (filter !== 'all') list = list.filter(n => n.cat === filter);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const da = a.dateObj ? a.dateObj.getTime() : 0;
      const db = b.dateObj ? b.dateObj.getTime() : 0;
      return sort === 'desc' ? db - da : da - db;
    });
  }, [notices, filter, query, sort]);
}

// ===== ERROR MESSAGES =====
function errorTitle(code) {
  switch (code) {
    case 'PROXY_FAIL':   return 'Proxy servers unavailable';
    case 'PARSE_FAIL':   return 'Could not read DTU notices';
    case 'NETWORK_FAIL': return 'Network error';
    default:             return 'Something went wrong';
  }
}

function errorBody(code) {
  switch (code) {
    case 'PROXY_FAIL':   return 'All proxy servers failed. DTU website may be down or unreachable. Please try again later.';
    case 'PARSE_FAIL':   return 'Could not read DTU notices — site structure may have changed. Check the browser console for details.';
    case 'NETWORK_FAIL': return 'A network error occurred. Check your connection and retry.';
    default:             return 'An unexpected error occurred.';
  }
}

// ===== APP =====
export default function App() {
  const [notices,     setNotices]     = useState([]);
  const [status,      setStatus]      = useState('idle');  // idle | loading | error
  const [errCode,     setErrCode]     = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [cacheHit,    setCacheHit]    = useState(false);

  const [filter, setFilter] = useState('all');
  const [query,  setQuery]  = useState('');       // raw input
  const [debouncedQ, setDQ] = useState('');       // debounced, drives filter
  const [sort,   setSort]   = useState('desc');
  const [page,   setPage]   = useState(1);

  const debounceRef = useRef(null);

  // 300ms debounce on search input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDQ(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Reset to page 1 whenever the visible set changes
  useEffect(() => { setPage(1); }, [filter, debouncedQ, sort]);

  // force=true → bypass 5-min cache, always re-fetch
  const load = useCallback(async (force = false) => {
    setStatus('loading');
    setErrCode(null);
    if (force) setPage(1);  // reset page on manual refresh

    try {
      const { notices: data, fromCache } = await fetchNotices(force);
      setNotices(data);
      setCacheHit(fromCache);
      setStatus('idle');
      if (!fromCache) {
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      setStatus('error');
      setErrCode(err.code || 'UNKNOWN');
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const counts    = useCounts(notices);
  const filtered  = useFiltered(notices, filter, debouncedQ, sort);
  const visible   = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore   = visible.length < filtered.length;
  const remaining = filtered.length - visible.length;

  const catLabel = filter === 'all'
    ? 'All categories'
    : `${CATEGORIES[filter]?.emoji} ${CATEGORIES[filter]?.label}`;

  return (
    <>
      <Navbar
        onRefresh={() => load(true)}
        loading={status === 'loading'}
      />

      <main className="page-wrapper">

        {/* ── Search & Controls ── */}
        <section className="controls-bar" aria-label="Search and sort controls">
          <div className="search-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              id="search-input"
              className="search-input"
              placeholder="Search notices by keyword…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              aria-label="Search notices"
            />
          </div>

          <div className="meta-row">
            {notices.length > 0 && (
              <div className="meta-chip">
                <span>📋</span>
                <strong>{notices.length}</strong>&nbsp;notices total
              </div>
            )}
            {lastUpdated && (
              <div className="meta-chip" title={cacheHit ? 'Served from cache' : 'Freshly fetched'}>
                <span>{cacheHit ? '⚡' : '🕐'}</span>
                {cacheHit ? 'From cache' : `Updated ${lastUpdated}`}
              </div>
            )}
            <button
              className="sort-btn"
              onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}
              id="sort-btn"
              aria-label="Toggle sort order"
            >
              <span aria-hidden="true">{sort === 'desc' ? '↓' : '↑'}</span>
              {sort === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        </section>

        {/* ── Category Filters ── */}
        <FilterBar active={filter} counts={counts} onSelect={setFilter} />

        {/* ── Results Label ── */}
        {status === 'idle' && notices.length > 0 && (
          <div className="results-bar">
            Showing <strong>{visible.length}</strong> of <strong>{filtered.length}</strong> · {catLabel}
          </div>
        )}

        {/* ── Cards Grid ── */}
        <div className="cards-grid" role="list" aria-live="polite" aria-label="Notice cards">

          {status === 'loading' && (
            <div className="state-box">
              <div className="spinner" aria-label="Loading" />
              <p className="state-title">Fetching latest notices…</p>
              <p className="state-msg">Trying proxy servers. This may take a moment.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="state-box">
              <span className="state-icon">⚠️</span>
              <p className="state-title">{errorTitle(errCode)}</p>
              <p className="state-msg">{errorBody(errCode)}</p>
              <button className="retry-btn" onClick={() => load(true)} id="retry-btn">
                ↻ Retry
              </button>
            </div>
          )}

          {status === 'idle' && notices.length > 0 && filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔎</div>
              <p className="empty-title">No notices found</p>
              <p className="empty-msg">
                {query ? 'Try a different keyword.' : 'No notices in this category yet.'}
              </p>
            </div>
          )}

          {status === 'idle' && visible.map(n => (
            <NoticeCard key={n.id} notice={n} />
          ))}
        </div>

        {/* ── Load More ── */}
        {status === 'idle' && hasMore && (
          <div className="load-more-wrap">
            <button
              className="load-more-btn"
              onClick={() => setPage(p => p + 1)}
              id="load-more-btn"
            >
              Load {Math.min(PAGE_SIZE, remaining)} more
              <span className="load-more-sub"> · {remaining} remaining</span>
            </button>
          </div>
        )}

      </main>
    </>
  );
}
