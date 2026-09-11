import { useEffect, useState } from 'react';
import type { Project, ProjectStage } from '../../domain/projects';
import type { EventRepository } from '../../repositories/EventRepository';
import type { ProjectTimelineRepository } from '../../repositories/ProjectTimelineRepository';
import { ProjectTimelineTab } from './ProjectTimelineTab';

interface Props {
  project: Project;
  stages: ProjectStage[];
  timelineRepository: ProjectTimelineRepository;
  eventRepository: EventRepository;
  now: Date;
  onClose: () => void;
  onArchive: () => void;
  onEdit?: () => void;
}

const priorityLabel: Record<Project['priority'], string> = {
  critical: '긴급',
  high: '높음',
  normal: '보통',
  low: '낮음',
};

function formatCost(value?: number | null): string {
  if (value == null) return '-';
  return `${Math.round(value / 100_000_000).toLocaleString('ko-KR')}억원`;
}

export function ProjectDetailPanel({
  project,
  stages,
  timelineRepository,
  eventRepository,
  now,
  onClose,
  onArchive,
  onEdit,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');
  const stage = stages.find((item) => item.key === project.currentStage)?.name ?? project.currentStage;

  useEffect(() => {
    setActiveTab('overview');
  }, [project.id]);

  return (
    <aside className="master-detail-panel" aria-label="사업 상세">
      <div className="master-detail-header">
        <div>
          <span className="master-eyebrow">PROJECT</span>
          <h2>{project.name}</h2>
        </div>
        <button type="button" className="icon-button" aria-label="사업 상세 닫기" onClick={onClose}>×</button>
      </div>

      <div className="master-detail-status-row">
        <span className="status-badge">{stage}</span>
        <span className={`priority-badge priority-${project.priority}`}>{priorityLabel[project.priority]}</span>
      </div>

      <div className="master-detail-tabs" aria-label="사업 상세 보기">
        <button
          type="button"
          className={activeTab === 'overview' ? 'is-active' : ''}
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          개요
        </button>
        <button
          type="button"
          className={activeTab === 'timeline' ? 'is-active' : ''}
          aria-selected={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
      </div>

      {activeTab === 'overview' ? (
        <dl className="master-detail-list">
          <div><dt>사업코드</dt><dd>{project.projectCode ?? '-'}</dd></div>
          <div><dt>발주처</dt><dd>{project.clientName ?? '-'}</dd></div>
          <div><dt>공사유형</dt><dd>{project.projectType ?? '-'}</dd></div>
          <div><dt>지역</dt><dd>{project.region ?? '-'}</dd></div>
          <div><dt>계약방식</dt><dd>{project.contractType ?? '-'}</dd></div>
          <div><dt>공사비</dt><dd>{formatCost(project.estimatedCost)}</dd></div>
          <div><dt>담당자</dt><dd>{project.assignee ?? '-'}</dd></div>
          <div><dt>입찰예정일</dt><dd>{project.expectedBidDate ?? '-'}</dd></div>
          <div className="master-detail-full"><dt>사업개요</dt><dd>{project.description ?? '-'}</dd></div>
          <div className="master-detail-full"><dt>영업 메모</dt><dd>{project.memo ?? '-'}</dd></div>
          <div className="master-detail-full"><dt>URL</dt><dd className="break-anywhere">{project.url ?? '-'}</dd></div>
          <div><dt>수정일</dt><dd>{project.updatedAt.slice(0, 10)}</dd></div>
        </dl>
      ) : (
        <ProjectTimelineTab
          project={project}
          stages={stages}
          timelineRepository={timelineRepository}
          eventRepository={eventRepository}
          now={now}
        />
      )}

      <div className="master-detail-actions">
        <button type="button" className="secondary-action danger-secondary" onClick={onArchive}>보관</button>
        {onEdit ? <button type="button" className="primary-action" onClick={onEdit}>수정</button> : null}
      </div>
    </aside>
  );
}
