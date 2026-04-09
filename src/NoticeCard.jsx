import { CATEGORIES, formatDate, isRecent, isSafeUrl } from './utils';

export default function NoticeCard({ notice }) {
  const { id, title, href, dateObj, cat } = notice;
  const catInfo  = CATEGORIES[cat];
  const recent   = isRecent(dateObj);
  // Double-check at render time — defence in depth
  const safeHref = isSafeUrl(href) ? href : '#';

  return (
    <a
      className={`notice-card cat-${cat}`}
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      role="listitem"
      aria-label={`${title} — ${formatDate(dateObj)}`}
      id={`notice-${id}`}
    >
      <div className="notice-card-top">
        <span className={`notice-cat-badge badge-${cat}`}>
          {catInfo.label}
        </span>
        <span className="notice-date">
          {recent && <span className="notice-dot" title="Posted this week" />}
          {formatDate(dateObj)}
        </span>
      </div>

      <p className="notice-title">{title}</p>

      <div className="notice-footer">
        <span className="notice-view-link">View Notice</span>
      </div>
    </a>
  );
}
