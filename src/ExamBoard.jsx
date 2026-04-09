import { useState, useMemo } from 'react';
import { examSubCat, formatDate, isRecent, isSafeUrl } from './utils';

const TABS = [
  { key: 'seating',   label: 'Seating Plan',  icon: '🪑', flag: true  },
  { key: 'datesheet', label: 'Datesheet',      icon: '📋', flag: false },
  { key: 'other',     label: 'Miscellaneous',  icon: '📌', flag: false },
];

function ExamItem({ notice }) {
  const safeHref = isSafeUrl(notice.href) ? notice.href : '#';
  const recent   = isRecent(notice.dateObj);

  return (
    <a
      className="exam-item"
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      id={`exam-${notice.id}`}
    >
      <div className="exam-item-body">
        <p className="exam-item-title">{notice.title}</p>
        <span className="exam-item-date">
          {recent && <span className="exam-item-dot" title="Posted this week" />}
          📅 {formatDate(notice.dateObj)}
        </span>
      </div>
      <span className="exam-item-arrow">→</span>
    </a>
  );
}

export default function ExamBoard({ notices }) {
  const [activeTab, setActiveTab] = useState('seating');

  // Split exam notices into sub-categories
  const grouped = useMemo(() => {
    const groups = { seating: [], datesheet: [], other: [] };
    notices.forEach(n => {
      const sub = examSubCat(n.title);
      groups[sub].push(n);
    });
    return groups;
  }, [notices]);

  const activeNotices = grouped[activeTab] || [];

  // Don't render at all if there are no exam notices
  if (notices.length === 0) return null;

  return (
    <section className="exam-board" aria-label="Examination Board">
      <div className="exam-board-header">
        <div className="exam-board-title-row">
          <h2 className="exam-board-title">🎓 Exam Board</h2>
          <span className="exam-board-count">{notices.length} notices</span>
        </div>
        <p className="exam-board-desc">
          Quick access to seating plans, datesheets, and other exam notices
        </p>
      </div>

      {/* Tabs */}
      <div className="exam-tabs" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`exam-tab ${activeTab === tab.key ? 'active' : ''} ${tab.flag && grouped.seating.length > 0 ? 'flagged' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            id={`exam-tab-${tab.key}`}
          >
            <span className="exam-tab-icon">{tab.icon}</span>
            <span className="exam-tab-label">{tab.label}</span>
            <span className="exam-tab-count">{grouped[tab.key].length}</span>
            {tab.flag && grouped.seating.length > 0 && (
              <span className="exam-tab-flag" title="High demand during exam season">🔥</span>
            )}
          </button>
        ))}
      </div>

      {/* Notice List */}
      <div className="exam-list" role="tabpanel" aria-label={`${activeTab} notices`}>
        {activeNotices.length === 0 ? (
          <div className="exam-empty">
            <span className="exam-empty-icon">📭</span>
            <p>No {TABS.find(t => t.key === activeTab)?.label.toLowerCase()} notices right now</p>
          </div>
        ) : (
          activeNotices.map(n => <ExamItem key={n.id} notice={n} />)
        )}
      </div>
    </section>
  );
}
