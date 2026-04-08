export default function Navbar({ onRefresh, loading }) {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-brand">
        <div className="navbar-logo" aria-hidden="true">DTU</div>
        <div className="navbar-titles">
          <span className="navbar-main">Notices Dashboard</span>
          <span className="navbar-sub">Delhi Technological University</span>
        </div>
      </div>
      <button
        className={`navbar-refresh-btn${loading ? ' spinning' : ''}`}
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh notices"
        id="refresh-btn"
      >
        <span className="refresh-icon" aria-hidden="true">↻</span>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </nav>
  );
}
