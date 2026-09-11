import { useMemo, useState } from 'react';
import { AppSidebar, type AppView } from '../components/AppSidebar';
import { toDateKey } from '../domain/date';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { ClientsPage } from '../features/clients/ClientsPage';
import { QuickEventDialog } from '../features/events/QuickEventDialog';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { TodayPage } from '../features/today/TodayPage';
import { createRuntimeEventRepository } from '../repositories/runtimeEventRepository';
import { createRuntimeMasterRepositories } from '../repositories/runtimeMasterRepositories';

const viewCopy: Record<AppView, { title: string; subtitle: string }> = {
  today: { title: '오늘', subtitle: '마감과 우선순위를 빠르게 확인합니다.' },
  calendar: { title: '캘린더', subtitle: '사업과 입찰 일정을 한눈에 관리합니다.' },
  events: { title: '일정', subtitle: '전체 일정을 목록으로 확인합니다.' },
  projects: { title: '사업관리', subtitle: '사업별 진행단계와 주요 일정을 관리합니다.' },
  clients: { title: '발주처', subtitle: '발주처와 관련 사업을 관리합니다.' },
  pinned: { title: '중요일정', subtitle: '놓치면 안 되는 일정을 모아봅니다.' },
  settings: { title: '설정', subtitle: '표시, 알림 및 로컬 데이터 설정을 관리합니다.' },
};

export function App() {
  const appNow = useMemo(() => new Date(), []);
  const repository = useMemo(() => createRuntimeEventRepository(appNow), [appNow]);
  const masterRepositories = useMemo(() => createRuntimeMasterRepositories(appNow), [appNow]);
  const [activeView, setActiveView] = useState<AppView>('calendar');
  const [quickAddDateKey, setQuickAddDateKey] = useState<string | null>(null);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const copy = viewCopy[activeView];

  const openQuickAdd = (dateKey = toDateKey(appNow)) => {
    setActiveView('calendar');
    setQuickAddDateKey(dateKey);
  };

  let content;
  if (activeView === 'calendar') {
    content = (
      <CalendarPage
        repository={repository}
        initialDate={appNow}
        now={appNow}
        refreshKey={calendarRevision}
        onSelectDay={openQuickAdd}
      />
    );
  } else if (activeView === 'today') {
    content = <TodayPage repository={repository} now={appNow} />;
  } else if (activeView === 'projects') {
    content = (
      <ProjectsPage
        projectRepository={masterRepositories.projects}
        clientRepository={masterRepositories.clients}
        timelineRepository={masterRepositories.timeline}
        eventRepository={repository}
        now={appNow}
      />
    );
  } else if (activeView === 'clients') {
    content = (
      <ClientsPage
        clientRepository={masterRepositories.clients}
        projectRepository={masterRepositories.projects}
      />
    );
  } else {
    content = (
      <div className="empty-view">
        <div className="empty-view-copy">
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppSidebar activeView={activeView} onSelect={setActiveView} />

      <main className="workspace">
        <header className="workspace-topbar">
          <div className="topbar-context">
            <strong>{copy.title}</strong>
            <span>{copy.subtitle}</span>
          </div>

          <div className="topbar-actions">
            <div className="search-placeholder" aria-label="통합검색">
              <span aria-hidden="true">⌕</span>
              <span>사업·일정 검색</span>
              <span className="keyboard-key">Ctrl K</span>
            </div>
            <button
              type="button"
              className="primary-action"
              aria-label="일정 등록"
              onClick={() => openQuickAdd()}
            >
              + 일정 등록
            </button>
          </div>
        </header>

        <section className="workspace-content" aria-label={`${copy.title} 화면`}>
          {content}
        </section>
      </main>

      {quickAddDateKey ? (
        <QuickEventDialog
          repository={repository}
          projectRepository={masterRepositories.projects}
          initialDateKey={quickAddDateKey}
          onClose={() => setQuickAddDateKey(null)}
          onCreated={() => setCalendarRevision((revision) => revision + 1)}
        />
      ) : null}
    </div>
  );
}
