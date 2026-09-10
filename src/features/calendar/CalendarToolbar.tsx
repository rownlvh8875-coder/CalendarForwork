interface CalendarToolbarProps {
  monthDate: Date;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
}

export function CalendarToolbar({ monthDate, onPrevious, onToday, onNext }: CalendarToolbarProps) {
  const title = `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월`;

  return (
    <div className="calendar-toolbar">
      <div className="calendar-title-group">
        <div className="calendar-nav-actions" aria-label="달력 이동">
          <button type="button" className="icon-button" aria-label="이전 달" onClick={onPrevious}>
            ‹
          </button>
          <button type="button" className="today-button" onClick={onToday}>
            오늘
          </button>
          <button type="button" className="icon-button" aria-label="다음 달" onClick={onNext}>
            ›
          </button>
        </div>
        <h1>{title}</h1>
      </div>

      <div className="view-switcher" aria-label="달력 보기 방식">
        <button type="button" className="is-active" aria-pressed="true">월간</button>
        <button type="button" aria-pressed="false" disabled>주간</button>
        <button type="button" aria-pressed="false" disabled>목록</button>
      </div>
    </div>
  );
}
