import { useEffect, useMemo, useState } from 'react';
import type { Client } from '../../domain/clients';
import type { Project, ProjectStage } from '../../domain/projects';
import type { ClientRepository } from '../../repositories/ClientRepository';
import type { ProjectRepository } from '../../repositories/ProjectRepository';
import { ProjectDetailPanel } from './ProjectDetailPanel';
import { ProjectEditorDialog } from './ProjectEditorDialog';

interface Props {
  projectRepository: ProjectRepository;
  clientRepository: ClientRepository;
  now?: Date;
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

function formatTotalCost(value: number): string {
  if (value <= 0) return '-';
  const eok = Math.round(value / 100_000_000);
  if (eok >= 10_000) return `${(eok / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}조원`;
  return `${eok.toLocaleString('ko-KR')}억원`;
}

function dateDiffDays(from: Date, dateKey?: string | null): number | null {
  if (!dateKey) return null;
  const target = new Date(`${dateKey}T00:00:00`);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000);
}

export function ProjectsPage({ projectRepository, clientRepository, now = new Date() }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selected, setSelected] = useState<Project | null>(null);
  const [editing, setEditing] = useState<Project | 'new' | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [nextProjects, nextClients, nextStages] = await Promise.all([
        projectRepository.list(false),
        clientRepository.list(),
        projectRepository.listStages(),
      ]);
      setProjects(nextProjects);
      setClients(nextClients);
      setStages(nextStages);
      setSelected((current) => current ? nextProjects.find((item) => item.id === current.id) ?? null : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '사업 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectRepository, clientRepository]);

  const stageMap = useMemo(() => new Map(stages.map((stage) => [stage.key, stage.name])), [stages]);
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    return projects.filter((project) => {
      if (stageFilter !== 'all' && project.currentStage !== stageFilter) return false;
      if (!normalized) return true;
      const haystack = [
        project.name,
        project.projectCode,
        project.clientName,
        project.projectType,
        project.region,
        project.contractType,
        project.assignee,
      ].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
      return haystack.includes(normalized);
    });
  }, [projects, query, stageFilter]);

  const metrics = useMemo(() => {
    const nearBid = projects.filter((project) => {
      const days = dateDiffDays(now, project.expectedBidDate);
      return days != null && days >= 0 && days <= 90;
    }).length;
    return {
      active: projects.length,
      nearBid,
      high: projects.filter((project) => project.priority === 'critical' || project.priority === 'high').length,
      totalCost: projects.reduce((sum, project) => sum + (project.estimatedCost ?? 0), 0),
    };
  }, [projects, now]);

  async function archiveSelected() {
    if (!selected) return;
    await projectRepository.setArchived(selected.id, true);
    setSelected(null);
    await load();
  }

  function handleSaved(project: Project) {
    setEditing(null);
    setSelected(project);
    void load();
  }

  const noProjects = !loading && !error && projects.length === 0;
  const noFilterResult = !loading && !error && projects.length > 0 && filteredProjects.length === 0;

  return (
    <div className="master-page project-master-page">
      <section className="master-summary-strip" aria-label="사업 요약">
        <div className="master-summary-item"><span>진행 사업</span><strong>{metrics.active}</strong></div>
        <div className="master-summary-item"><span>90일 내 입찰</span><strong>{metrics.nearBid}</strong></div>
        <div className="master-summary-item"><span>중요 사업</span><strong>{metrics.high}</strong></div>
        <div className="master-summary-item master-summary-cost"><span>추정 공사비</span><strong>{formatTotalCost(metrics.totalCost)}</strong></div>
      </section>

      <section className="master-workspace">
        <div className="master-list-pane">
          <div className="master-toolbar">
            <div className="master-toolbar-copy">
              <h2>사업 Master</h2>
              <span>{filteredProjects.length.toLocaleString('ko-KR')}건 표시</span>
            </div>
            <div className="master-toolbar-controls">
              <label className="master-search">
                <span aria-hidden="true">⌕</span>
                <input type="search" aria-label="사업 검색" placeholder="사업명·발주처·지역 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <select className="master-filter" aria-label="사업단계 필터" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                <option value="all">전체 단계</option>
                {stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.name} 단계</option>)}
              </select>
              <button type="button" className="primary-action" aria-label="사업 등록" onClick={() => setEditing('new')}>+ 사업 등록</button>
            </div>
          </div>

          {error ? <div className="master-state master-state-error" role="alert">{error}</div> : null}
          {loading ? <div className="master-state">사업 정보를 불러오는 중입니다.</div> : null}
          {noProjects ? <div className="master-state"><strong>등록된 사업이 없습니다.</strong><span>사업을 등록하면 발주처·단계·입찰일정을 한 화면에서 관리할 수 있습니다.</span></div> : null}
          {noFilterResult ? <div className="master-state"><strong>필터 조건에 맞는 사업이 없습니다.</strong><span>검색어 또는 사업단계를 변경해 보세요.</span></div> : null}

          {!loading && !error && filteredProjects.length > 0 ? (
            <div className="master-table-scroll">
              <table className="master-table project-table">
                <thead>
                  <tr>
                    <th>상태</th><th>사업명</th><th>발주처</th><th>공사유형 / 지역</th><th>계약방식</th><th className="numeric">공사비</th><th>담당자</th><th>입찰예정일</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const active = selected?.id === project.id;
                    const days = dateDiffDays(now, project.expectedBidDate);
                    return (
                      <tr key={project.id} className={active ? 'is-selected' : ''} tabIndex={0} onClick={() => setSelected(project)} onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelected(project);
                        }
                      }}>
                        <td><span className="status-badge">{stageMap.get(project.currentStage) ?? project.currentStage}</span></td>
                        <td className="project-name-cell">
                          <strong>{project.name}</strong>
                          <span>{project.projectCode ?? '코드 미지정'} · <span className={`priority-inline priority-${project.priority}`}>{priorityLabel[project.priority]}</span></span>
                        </td>
                        <td>{project.clientName ?? '-'}</td>
                        <td><strong className="cell-primary">{project.projectType ?? '-'}</strong><span className="cell-secondary">{project.region ?? '-'}</span></td>
                        <td>{project.contractType ?? '-'}</td>
                        <td className="numeric">{formatCost(project.estimatedCost)}</td>
                        <td>{project.assignee ?? '-'}</td>
                        <td className="bid-date-cell"><strong>{project.expectedBidDate ?? '-'}</strong>{days != null && days >= 0 ? <span>D-{days}</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {selected ? (
          <ProjectDetailPanel
            project={selected}
            stages={stages}
            onClose={() => setSelected(null)}
            onArchive={() => void archiveSelected()}
            onEdit={() => setEditing(selected)}
          />
        ) : null}
      </section>

      {editing ? (
        <ProjectEditorDialog
          repository={projectRepository}
          clients={clients}
          stages={stages}
          project={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
