export type AppView = 'today' | 'calendar' | 'events' | 'projects' | 'clients' | 'pinned' | 'settings';

type NavItem = {
  id: AppView;
  label: string;
  icon: string;
};

const primaryItems: NavItem[] = [
  { id: 'today', label: '오늘', icon: '◉' },
  { id: 'calendar', label: '캘린더', icon: '▦' },
  { id: 'events', label: '일정', icon: '☷' },
  { id: 'projects', label: '사업관리', icon: '◇' },
  { id: 'clients', label: '발주처', icon: '⌂' },
  { id: 'pinned', label: '중요일정', icon: '☆' },
];

export interface AppSidebarProps {
  activeView: AppView;
  onSelect: (view: AppView) => void;
}

export function AppSidebar({ activeView, onSelect }: AppSidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="주요 메뉴">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">C</div>
        <div className="brand-copy">
          <strong>CalendarForwork</strong>
          <span>토목영업 일정관리</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-section-label">WORKSPACE</span>
        {primaryItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${activeView === item.id ? ' is-active' : ''}`}
            aria-current={activeView === item.id ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button
          type="button"
          className={`nav-item${activeView === 'settings' ? ' is-active' : ''}`}
          aria-current={activeView === 'settings' ? 'page' : undefined}
          onClick={() => onSelect('settings')}
        >
          <span className="nav-icon" aria-hidden="true">⚙</span>
          <span>설정</span>
        </button>
        <div className="local-mode-pill">
          <span className="status-dot" aria-hidden="true" />
          개인 PC · 로컬 모드
        </div>
      </div>
    </aside>
  );
}
