import { useState, useMemo } from 'react';
import { scholSubCat, formatDate, isRecent, isSafeUrl } from './utils';

const TABS = [
  { key: 'concession',  label: 'Fee Concession' },
  { key: 'scholarship', label: 'Scholarships' },
  { key: 'medal',       label: 'Medals/Awards' },
  { key: 'other',       label: 'Miscellaneous' },
];

function ScholarshipItem({ notice }) {
  const safeHref = isSafeUrl(notice.href) ? notice.href : '#';
  const recent = isRecent(notice.dateObj);

  return (
    <a
      className="exam-item"
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      id={`schol-${notice.id}`}
    >
      <div className="exam-item-body">
        <p className="exam-item-title">{notice.title}</p>
        <span className="exam-item-date">
          {recent && <span className="exam-item-dot" title="Posted this week" />}
          {formatDate(notice.dateObj)}
        </span>
      </div>
      <span className="exam-item-arrow">View</span>
    </a>
  );
}

export default function ScholarshipBoard({ notices }) {
  const [activeTab, setActiveTab] = useState('concession');

  const grouped = useMemo(() => {
    const groups = { concession: [], scholarship: [], medal: [], other: [] };
    notices.forEach((n) => {
      const sub = scholSubCat(n.title);
      groups[sub].push(n);
    });
    return groups;
  }, [notices]);

  const activeNotices = grouped[activeTab] || [];

  if (notices.length === 0) return null;

  return (
    <section className="exam-board scholarship-board" aria-label="Scholarships Board">
      <div className="exam-board-header">
        <div className="exam-board-title-row">
          <h2 className="exam-board-title">Scholarships Board</h2>
          <span className="exam-board-count">{notices.length} notices</span>
        </div>
        <p className="exam-board-desc">
          Quick access to fee concession, scholarship, and medal award notices
        </p>
      </div>

      <div className="exam-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`exam-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            id={`schol-tab-${tab.key}`}
          >
            <span className="exam-tab-label">{tab.label}</span>
            <span className="exam-tab-count">{grouped[tab.key].length}</span>
          </button>
        ))}
      </div>

      <div className="exam-list" role="tabpanel" aria-label={`${activeTab} scholarship notices`}>
        <div className="tab-panel-content" key={activeTab}>
          {activeNotices.length === 0 ? (
            <div className="exam-empty">
              <p>No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} notices right now</p>
            </div>
          ) : (
            activeNotices.map((n) => <ScholarshipItem key={n.id} notice={n} />)
          )}
        </div>
      </div>
    </section>
  );
}
