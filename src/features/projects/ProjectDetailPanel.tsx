import type { Project, ProjectStage } from '../../domain/projects';

interface Props {
  project: Project;
  stages: ProjectStage[];
  onClose: () => void;
  onArchive: () => void;
}

function formatCost(value?: number | null): string {
  if (value == null) return '-';
  return `${Math.round(value / 100_000_000).toLocaleString('ko-KR')}억원`;
}

export function ProjectDetailPanel({ project, stages, onClose, onArchive }: Props) {
  const stage = stages.find((item) => item.key === project.currentStage)?.name ?? project.currentStage;

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
        <span className={`priority-badge priority-${project.priority}`}>{project.priority}</span>
      </div>

      <dl className="master-detail-list">
        <div><dt>사업코드</dt><dd>{project.projectCode ?? '-'}</dd></div>
        <div><dt>발주처</dt><dd>{project.clientName ?? '-'}</dd></div>
        <div><dt>공사유형</dt><dd>{project.projectType ?? '-'}</dd></div>
        <div><dt>지역</dt><dd>{project.region ?? '-'}</dd></div>
        <div><dt>계약방식</dt><dd>{project.contractType ?? '-'}</dd></div>
        <div><dt>공사비</dt><dd>{formatCost(project.estimatedCost)}</dd></div>
        <div><dt>담당자</dt><dd>{project.assignee ?? '-'}</dd></div>
        <div><dt>입찰예정일</dt><dd>{project.expectedBidDate ?? '-'}</dd></div>
        <div><dt>설명</dt><dd>{project.description ?? '-'}</dd></div>
        <div><dt>메모</dt><dd>{project.memo ?? '-'}</dd></div>
        <div><dt>URL</dt><dd>{project.url ?? '-'}</dd></div>
        <div><dt>수정일</dt><dd>{project.updatedAt.slice(0, 10)}</dd></div>
      </dl>

      <div className="master-detail-actions">
        <button type="button" className="secondary-action" onClick={onArchive}>보관</button>
      </div>
    </aside>
  );
}
