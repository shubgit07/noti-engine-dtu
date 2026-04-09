import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Navbar     from './Navbar';
import FilterBar  from './FilterBar';
import NoticeCard from './NoticeCard';
import ExamBoard  from './ExamBoard';
import ScholarshipBoard from './ScholarshipBoard';
import { fetchNotices, CATEGORIES } from './utils';

const CHUNK_SIZE = 50;
const LOADING_MESSAGES = [
  'Fetching fresh notices...',
  '😭 Our college site is slow...',
  "DW, working on a fix once for all 💪...",
];

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
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [cacheHit,    setCacheHit]    = useState(false);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreErr, setLoadMoreErr] = useState('');

  const [filter, setFilter] = useState('all');
  const [query,  setQuery]  = useState('');       // raw input
  const [debouncedQ, setDQ] = useState('');       // debounced, drives filter
  const [sort,   setSort]   = useState('desc');
  const [loadingStep, setLoadingStep] = useState(0);

  const debounceRef = useRef(null);

  // 300ms debounce on search input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDQ(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Rotate loading messages while fetch is in progress
  useEffect(() => {
    if (status !== 'loading') {
      setLoadingStep(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);

    return () => clearInterval(timer);
  }, [status]);

  // force=true → bypass 5-min cache, always re-fetch
  const load = useCallback(async (force = false) => {
    setStatus('loading');
    setErrCode(null);
    setLoadMoreErr('');
    setLoadingMore(false);

    try {
      const {
        notices: data,
        fromCache,
        total,
        nextOffset: freshOffset,
      } = await fetchNotices({ force, offset: 0, limit: CHUNK_SIZE });
      setNotices(data);
      setCacheHit(fromCache);
      setTotalAvailable(total ?? data.length);
      setNextOffset(freshOffset ?? data.length);
      setStatus('idle');
      if (!fromCache) {
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setLastUpdatedAt(now.getTime());
      }
    } catch (err) {
      setStatus('error');
      setErrCode(err.code || 'UNKNOWN');
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const filtered    = useFiltered(notices, filter, debouncedQ, sort);
  const hasMore     = nextOffset < totalAvailable;
  const remaining   = Math.max(0, totalAvailable - nextOffset);
  const examNotices = useMemo(() => notices.filter(n => n.cat === 'exam'), [notices]);
  const scholNotices = useMemo(() => notices.filter(n => n.cat === 'schol'), [notices]);

  const catLabel = filter === 'all'
    ? 'All categories'
    : `${CATEGORIES[filter]?.label}`;

  const cacheStatusText = useMemo(() => {
    if (cacheHit) {
      if (!lastUpdatedAt) return 'Cached result (up to 5 mins old)';
      const mins = Math.max(1, Math.floor((Date.now() - lastUpdatedAt) / 60000));
      return `Cached result ${mins} min${mins > 1 ? 's' : ''} ago`;
    }
    if (lastUpdated) return `Fresh fetch at ${lastUpdated}`;
    return 'Fetching fresh notices';
  }, [cacheHit, lastUpdatedAt, lastUpdated]);

  const loadMore = useCallback(async () => {
    if (loadingMore || status === 'loading' || !hasMore) return;

    setLoadingMore(true);
    setLoadMoreErr('');

    try {
      const {
        notices: nextChunk,
        total,
        nextOffset: newOffset,
      } = await fetchNotices({ force: false, offset: nextOffset, limit: CHUNK_SIZE });

      setNotices(prev => [...prev, ...nextChunk]);
      setTotalAvailable(total ?? totalAvailable);
      setNextOffset(newOffset ?? (nextOffset + nextChunk.length));
    } catch (err) {
      setLoadMoreErr(errorBody(err.code || 'UNKNOWN'));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, status, hasMore, nextOffset, totalAvailable]);

  return (
    <>
      <Navbar
        onRefresh={() => load(true)}
        loading={status === 'loading'}
      />

      <main className="page-wrapper px-3 sm:px-4 lg:px-6">

        {/* ── Search & Controls ── */}
        <section className="controls-bar flex-col items-stretch sm:flex-row sm:items-center" aria-label="Search and sort controls">
          <div className="search-wrap w-full sm:w-auto">
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
            <p className="cache-hint" aria-live="polite">
              {cacheStatusText} · Auto refreshes every 5 mins
            </p>
          </div>

          <div className="meta-row w-full justify-between sm:w-auto sm:justify-start">
            {notices.length > 0 && (
              <div className="meta-chip">
                <strong>{notices.length}</strong>&nbsp;notices total
              </div>
            )}
            {lastUpdated && (
              <div className="meta-chip" title={cacheHit ? 'Served from cache' : 'Freshly fetched'}>
                {cacheHit ? 'From cache' : `Updated ${lastUpdated}`}
              </div>
            )}
            <button
              className="sort-btn min-h-11"
              onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}
              id="sort-btn"
              aria-label="Toggle sort order"
            >
              <span aria-hidden="true">{sort === 'desc' ? 'v' : '^'}</span>
              {sort === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        </section>

        {/* ── Category Filters ── */}
        <FilterBar active={filter} onSelect={setFilter} showCounts={false} />

        {/* ── Results Label ── */}
        {status === 'idle' && notices.length > 0 && (
          <div className="results-bar">
            Loaded <strong>{notices.length}</strong> of <strong>{totalAvailable || notices.length}</strong> notices · Showing <strong>{filtered.length}</strong> · {catLabel}
          </div>
        )}

        {/* ── Exam Board ── */}
        {status === 'idle' && filter === 'exam' && examNotices.length > 0 && (
          <ExamBoard notices={examNotices} />
        )}

        {/* ── Scholarship Board ── */}
        {status === 'idle' && filter === 'schol' && scholNotices.length > 0 && (
          <ScholarshipBoard notices={scholNotices} />
        )}

        {/* ── Cards Grid ── */}
        <div className="cards-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-live="polite" aria-label="Notice cards">

          {status === 'loading' && (
            <div className="state-box">
              <div className="spinner" aria-label="Loading" />
              <p className="state-title loading-msg-swap" key={`loading-msg-${loadingStep}`}>
                {LOADING_MESSAGES[loadingStep]}
              </p>
              <p className="state-msg">Trying proxy servers. Thanks for your patience.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="state-box">
              <p className="state-title">{errorTitle(errCode)}</p>
              <p className="state-msg">{errorBody(errCode)}</p>
              <button className="retry-btn" onClick={() => load(true)} id="retry-btn">
                Retry
              </button>
            </div>
          )}

          {status === 'idle' && notices.length > 0 && filtered.length === 0 && (
            <div className="empty-state">
              <p className="empty-title">No notices found</p>
              <p className="empty-msg">
                {query ? 'Try a different keyword.' : 'No notices in this category yet.'}
              </p>
            </div>
          )}

          {status === 'idle' && filtered.map(n => (
            <NoticeCard key={n.id} notice={n} />
          ))}
        </div>

        {/* ── Load More ── */}
        {status === 'idle' && hasMore && (
          <div className="load-more-wrap">
            <button
              className="load-more-btn min-h-11"
              onClick={loadMore}
              disabled={loadingMore}
              id="load-more-btn"
            >
              {loadingMore ? 'Loading more notices...' : `Load next ${Math.min(CHUNK_SIZE, remaining)} notices`}
              <span className="load-more-sub"> · {remaining} remaining</span>
            </button>
            {loadMoreErr && (
              <p className="state-msg" style={{ marginTop: '.5rem' }}>
                {loadMoreErr}
              </p>
            )}
          </div>
        )}

      </main>
    </>
  );
}
