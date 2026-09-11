import { useEffect, useMemo, useState } from 'react';
import type { CalendarEvent } from '../../domain/calendar';
import type { Project, ProjectStage } from '../../domain/projects';
import type { ProjectStageHistory } from '../../domain/timeline';
import type { EventRepository } from '../../repositories/EventRepository';
import type { ProjectTimelineRepository } from '../../repositories/ProjectTimelineRepository';
import {
  buildProjectTimeline,
  formatStageTransition,
  formatTimelineDday,
} from './projectTimelineModel';

interface Props {
  project: Project;
  stages: ProjectStage[];
  timelineRepository: ProjectTimelineRepository;
  eventRepository: EventRepository;
  now: Date;
}

function formatTimelineTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function ProjectTimelineTab({
  project,
  stages,
  timelineRepository,
  eventRepository,
  now,
}: Props) {
  const [history, setHistory] = useState<ProjectStageHistory[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    void Promise.all([
      timelineRepository.listStageHistory(project.id),
      eventRepository.listByProject(project.id),
    ])
      .then(([nextHistory, nextEvents]) => {
        if (cancelled) return;
        setHistory(nextHistory);
        setEvents(nextEvents);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project.id, timelineRepository, eventRepository]);

  const stageMap = useMemo(
    () => new Map(stages.map((stage) => [stage.key, stage.name])),
    [stages],
  );
  const items = useMemo(
    () => buildProjectTimeline(history, events),
    [history, events],
  );

  if (loading) {
    return <div className="project-timeline-state">Timeline을 불러오는 중입니다.</div>;
  }

  if (error) {
    return <div className="project-timeline-state project-timeline-error" role="alert">Timeline을 불러오지 못했습니다.</div>;
  }

  if (items.length === 0) {
    return <div className="project-timeline-state">아직 기록된 Timeline 항목이 없습니다.</div>;
  }

  return (
    <div className="project-timeline-feed" aria-label="사업 Timeline">
      {items.map((item) => {
        if (item.kind === 'stage') {
          const copy = formatStageTransition(item.history, stageMap);
          return (
            <article className="project-timeline-item is-stage" key={`stage:${item.id}`}>
              <span className="project-timeline-marker" aria-hidden="true" />
              <div className="project-timeline-copy">
                <span className="project-timeline-eyebrow">{copy.eyebrow}</span>
                <strong>{copy.title}</strong>
                <time dateTime={item.at}>{formatTimelineTime(item.at)}</time>
              </div>
            </article>
          );
        }

        const dday = formatTimelineDday(item.at, now);
        return (
          <article className="project-timeline-item is-event" key={`event:${item.id}`}>
            <span className="project-timeline-marker" aria-hidden="true" />
            <div className="project-timeline-copy">
              <span className="project-timeline-eyebrow">{item.event.categoryName}</span>
              <strong>{item.event.title}</strong>
              <div className="project-timeline-meta">
                <time dateTime={item.at}>{formatTimelineTime(item.at)}</time>
                {dday ? <span className="timeline-dday">{dday}</span> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
