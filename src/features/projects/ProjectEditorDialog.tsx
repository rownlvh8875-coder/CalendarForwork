import { FormEvent, useMemo, useState } from 'react';
import type { Client } from '../../domain/clients';
import type { NewProject, Project, ProjectPriority, ProjectStage } from '../../domain/projects';
import type { ProjectRepository } from '../../repositories/ProjectRepository';

interface Props {
  repository: ProjectRepository;
  clients: Client[];
  stages: ProjectStage[];
  project?: Project | null;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toEok(value?: number | null): string {
  return value == null ? '' : String(value / 100_000_000);
}

export function ProjectEditorDialog({ repository, clients, stages, project, onClose, onSaved }: Props) {
  const [name, setName] = useState(project?.name ?? '');
  const [projectCode, setProjectCode] = useState(project?.projectCode ?? '');
  const [clientId, setClientId] = useState(project?.clientId ?? '');
  const [currentStage, setCurrentStage] = useState(project?.currentStage ?? stages[0]?.key ?? 'interest');
  const [priority, setPriority] = useState<ProjectPriority>(project?.priority ?? 'normal');
  const [projectType, setProjectType] = useState(project?.projectType ?? '');
  const [region, setRegion] = useState(project?.region ?? '');
  const [contractType, setContractType] = useState(project?.contractType ?? '');
  const [estimatedCostEok, setEstimatedCostEok] = useState(toEok(project?.estimatedCost));
  const [assignee, setAssignee] = useState(project?.assignee ?? '');
  const [expectedBidDate, setExpectedBidDate] = useState(project?.expectedBidDate ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [memo, setMemo] = useState(project?.memo ?? '');
  const [url, setUrl] = useState(project?.url ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = project ? '사업 수정' : '사업 등록';
  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
    [clients],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('사업명을 입력해 주세요.');
      return;
    }

    const numericCost = estimatedCostEok.trim() === '' ? null : Number(estimatedCostEok.replaceAll(',', ''));
    if (numericCost != null && (!Number.isFinite(numericCost) || numericCost < 0)) {
      setError('공사비는 0 이상의 숫자로 입력해 주세요.');
      return;
    }

    const input: NewProject = {
      projectCode: optional(projectCode),
      name: name.trim(),
      clientId: optional(clientId),
      projectType: optional(projectType),
      region: optional(region),
      contractType: optional(contractType),
      estimatedCost: numericCost == null ? null : Math.round(numericCost * 100_000_000),
      currentStage,
      priority,
      assignee: optional(assignee),
      expectedBidDate: optional(expectedBidDate),
      description: optional(description),
      memo: optional(memo),
      url: optional(url),
      archived: project?.archived ?? false,
    };

    try {
      setSaving(true);
      setError(null);
      const saved = project ? await repository.update(project.id, input) : await repository.create(input);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '사업 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="master-editor-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="quick-dialog-header">
          <div>
            <span className="dialog-eyebrow">PROJECT MASTER</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={`${title} 닫기`} onClick={onClose}>×</button>
        </header>

        <form className="master-editor-form" onSubmit={handleSubmit}>
          <div className="form-two-columns">
            <label className="form-field master-field-wide">
              <span>사업명 <em>*</em></span>
              <input aria-label="사업명" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            </label>
            <label className="form-field">
              <span>사업코드</span>
              <input aria-label="사업코드" value={projectCode} onChange={(event) => setProjectCode(event.target.value)} placeholder="예: RAIL-2027-01" />
            </label>
            <label className="form-field">
              <span>발주처</span>
              <select aria-label="발주처" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">미지정</option>
                {sortedClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>현재단계 <em>*</em></span>
              <select aria-label="현재단계" value={currentStage} onChange={(event) => setCurrentStage(event.target.value)}>
                {stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>중요도 <em>*</em></span>
              <select aria-label="중요도" value={priority} onChange={(event) => setPriority(event.target.value as ProjectPriority)}>
                <option value="critical">긴급</option>
                <option value="high">높음</option>
                <option value="normal">보통</option>
                <option value="low">낮음</option>
              </select>
            </label>
            <label className="form-field"><span>공사유형</span><input aria-label="공사유형" value={projectType} onChange={(event) => setProjectType(event.target.value)} placeholder="철도 / 도로 / 항만 / 공항" /></label>
            <label className="form-field"><span>지역</span><input aria-label="지역" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="서울 / 경기 / 부산" /></label>
            <label className="form-field"><span>계약방식</span><input aria-label="계약방식" value={contractType} onChange={(event) => setContractType(event.target.value)} placeholder="기술형입찰 등" /></label>
            <label className="form-field"><span>공사비(억원)</span><input aria-label="공사비" inputMode="decimal" value={estimatedCostEok} onChange={(event) => setEstimatedCostEok(event.target.value)} placeholder="3200" /></label>
            <label className="form-field"><span>담당자</span><input aria-label="담당자" value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label>
            <label className="form-field"><span>입찰예정일</span><input aria-label="입찰예정일" type="date" value={expectedBidDate} onChange={(event) => setExpectedBidDate(event.target.value)} /></label>
          </div>

          <label className="form-field"><span>사업개요</span><textarea aria-label="사업개요" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
          <label className="form-field"><span>영업 메모</span><textarea aria-label="영업 메모" value={memo} onChange={(event) => setMemo(event.target.value)} rows={3} /></label>
          <label className="form-field"><span>관련 URL</span><input aria-label="관련 URL" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <footer className="quick-dialog-footer master-editor-footer">
            <span className="dialog-hint">사업명·단계·중요도만 입력해도 저장할 수 있습니다.</span>
            <div>
              <button type="button" className="secondary-action" onClick={onClose}>취소</button>
              <button type="submit" className="primary-action" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
