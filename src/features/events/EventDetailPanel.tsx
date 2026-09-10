import { useEffect } from 'react';
import type { CalendarEvent, EventPriority, EventStatus } from '../../domain/calendar';
import { CategoryBadge } from '../../components/CategoryBadge';

const statusLabels: Record<EventStatus, string> = {
  planned: '예정',
  'in-progress': '진행중',
  completed: '완료',
  cancelled: '취소',
};

const priorityLabels: Record<EventPriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  critical: '긴급',
};

interface EventDetailPanelProps {
  event: CalendarEvent;
  onClose: () => void;
  onComplete: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function EventDetailPanel({ event, onClose, onComplete, onDelete }: EventDetailPanelProps) {
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <aside className="event-detail-panel" aria-label="일정 상세">
      <header className="detail-panel-header">
        <div className="detail-heading-copy">
          <CategoryBadge categoryKey={event.categoryKey} label={event.categoryName} />
          <h2>{event.title}</h2>
        </div>
        <button type="button" className="panel-close-button" aria-label="상세 닫기" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="detail-panel-body">
        <section className="detail-primary-card">
          <div className="detail-project-name">{event.projectName ?? '연결된 사업 없음'}</div>
          <div className="detail-client-name">{event.clientName ?? '발주처 미지정'}</div>
        </section>

        <dl className="detail-grid">
          <div>
            <dt>일정</dt>
            <dd>{formatDateTime(event.startAt)}</dd>
          </div>
          <div>
            <dt>마감</dt>
            <dd>{formatDateTime(event.deadlineAt)}</dd>
          </div>
          <div>
            <dt>상태</dt>
            <dd><span className={`state-pill state-${event.status}`}>{statusLabels[event.status]}</span></dd>
          </div>
          <div>
            <dt>중요도</dt>
            <dd><span className={`priority-pill priority-${event.priority}`}>{priorityLabels[event.priority]}</span></dd>
          </div>
          <div>
            <dt>담당자</dt>
            <dd>{event.assignee ?? '-'}</dd>
          </div>
          <div>
            <dt>장소</dt>
            <dd>{event.location ?? '-'}</dd>
          </div>
        </dl>

        <section className="detail-section">
          <h3>메모</h3>
          <p className={event.memo ? '' : 'is-empty'}>{event.memo ?? '등록된 메모가 없습니다.'}</p>
        </section>

        {event.url ? (
          <section className="detail-section">
            <h3>관련 링크</h3>
            <a href={event.url} target="_blank" rel="noreferrer">{event.url}</a>
          </section>
        ) : null}
      </div>

      <footer className="detail-panel-footer">
        <button type="button" className="danger-ghost-button" onClick={() => void onDelete(event.id)}>
          삭제
        </button>
        <div className="detail-footer-actions">
          <button type="button" className="secondary-action" onClick={onClose}>닫기</button>
          {event.status !== 'completed' ? (
            <button type="button" className="primary-action" onClick={() => void onComplete(event.id)}>
              완료 처리
            </button>
          ) : null}
        </div>
      </footer>
    </aside>
  );
}
