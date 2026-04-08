import { CATEGORIES } from './utils';

export default function FilterBar({ active, counts, onSelect }) {
  const filters = [
    { key: 'all', emoji: '📌', label: 'All' },
    ...Object.entries(CATEGORIES).map(([key, cat]) => ({ key, emoji: cat.emoji, label: cat.label })),
  ];

  return (
    <div className="filter-bar" role="tablist" aria-label="Category filters">
      {filters.map(({ key, emoji, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          className={`filter-btn${active === key ? ' active' : ''}`}
          id={`filter-${key}`}
          onClick={() => onSelect(key)}
        >
          <span aria-hidden="true">{emoji}</span>
          <span className="filter-label">{label}</span>
          <span className="filter-badge">{counts[key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
