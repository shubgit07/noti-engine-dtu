import { CATEGORIES } from './utils';

export default function FilterBar({ active, counts = {}, onSelect, showCounts = true }) {
  const filters = [
    { key: 'all', label: 'All' },
    ...Object.entries(CATEGORIES).map(([key, cat]) => ({ key, label: cat.label })),
  ];

  return (
    <div className="filter-bar" role="tablist" aria-label="Category filters">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          className={`filter-btn min-h-11 ${active === key ? 'active' : ''}`}
          id={`filter-${key}`}
          onClick={() => onSelect(key)}
        >
          <span className="filter-label">{label}</span>
          {showCounts && (
            <span className="filter-badge">
              {counts[key] ?? 0}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
