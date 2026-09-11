import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { defaultCategories } from '../../data/categories';
import type { CalendarEvent, EventPriority } from '../../domain/calendar';
import type { Project } from '../../domain/projects';
import type { EventRepository } from '../../repositories/EventRepository';
import type { ProjectRepository } from '../../repositories/ProjectRepository';

interface QuickEventDialogProps {
  repository: EventRepository;
  projectRepository?: ProjectRepository;
  initialDateKey: string;
  onClose: () => void;
  onCreated?: (event: CalendarEvent) => void;
}

const priorityOptions: Array<{ value: EventPriority; label: string }> = [
  { value: 'low', label: '낮음' },
  { value: 'normal', label: '보통' },
  { value: 'high', label: '높음' },
  { value: 'critical', label: '긴급' },
];

function toLocalIso(dateKey: string, time: string): string {
  const normalizedTime = time || '09:00';
  const local = new Date(`${dateKey}T${normalizedTime}:00`);
  const offsetMinutes = -local.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `${dateKey}T${normalizedTime}:00${sign}${hours}:${minutes}`;
}

export function QuickEventDialog({ repository, projectRepository, initialDateKey, onClose, onCreated }: QuickEventDialogProps) {
  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState(initialDateKey);
  const [categoryKey, setCategoryKey] = useState('other');
  const [priority, setPriority] = useState<EventPriority>('normal');
  const [startTime, setStartTime] = useState('09:00');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const category = useMemo(
    () => defaultCategories.find((item) => item.key === categoryKey) ?? defaultCategories.at(-1)!,
    [categoryKey],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!projectRepository) {
      setProjects([]);
      setProjectLoadError(null);
      return () => { cancelled = true; };
    }

    void projectRepository.list(false)
      .then((items) => {
        if (!cancelled) {
          setProjects(items);
          setProjectLoadError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setProjectLoadError(cause instanceof Error ? cause.message : '사업 목록을 불러오지 못했습니다.');
        }
      });

    return () => { cancelled = true; };
  }, [projectRepository]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('일정명을 입력하세요.');
      return;
    }

    if (!dateKey) {
      setError('날짜를 선택하세요.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const created = await repository.create({
        projectId: selectedProject?.id ?? null,
        projectName: selectedProject?.name ?? projectName.trim() || null,
        clientName: selectedProject?.clientName ?? clientName.trim() || null,
        categoryId: category.id,
        categoryKey: category.key,
        categoryName: category.name,
        title: trimmedTitle,
        description: null,
        startAt: toLocalIso(dateKey, startTime),
        endAt: null,
        deadlineAt: deadlineTime ? toLocalIso(dateKey, deadlineTime) : null,
        allDay: false,
        status: 'planned',
        priority,
        assignee: null,
        location: null,
        url: null,
        memo: null,
        isPinned: priority === 'critical',
        completedAt: null,
      });

      onCreated?.(created);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '일정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) {
        onClose();
      }
    }}>
      <section className="quick-event-dialog" role="dialog" aria-modal="true" aria-label="빠른 일정 등록">
        <header className="quick-dialog-header">
          <div>
            <span className="dialog-eyebrow">QUICK ADD</span>
            <h2>일정 등록</h2>
          </div>
          <button type="button" className="panel-close-button" aria-label="등록창 닫기" onClick={onClose} disabled={isSaving}>
            ×
          </button>
        </header>

        <form className="quick-event-form" onSubmit={handleSubmit}>
          <label className="form-field form-field-wide">
            <span>일정명 <em>필수</em></span>
            <input
              aria-label="일정명"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: PQ 제출서류 최종 점검"
            />
          </label>

          <div className="form-two-columns">
            <label className="form-field">
              <span>날짜 <em>필수</em></span>
              <input aria-label="날짜" type="date" value={dateKey} onChange={(event) => setDateKey(event.target.value)} />
            </label>
            <label className="form-field">
              <span>시간</span>
              <input aria-label="시간" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
          </div>

          <div className="form-two-columns">
            <label className="form-field">
              <span>구분</span>
              <select aria-label="구분" value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}>
                {defaultCategories.map((item) => (
                  <option key={item.id} value={item.key}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>중요도</span>
              <select aria-label="중요도" value={priority} onChange={(event) => setPriority(event.target.value as EventPriority)}>
                {priorityOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-field form-field-wide">
            <span>마감시간</span>
            <input aria-label="마감시간" type="time" value={deadlineTime} onChange={(event) => setDeadlineTime(event.target.value)} />
          </label>

          {projectRepository ? (
            <label className="form-field form-field-wide">
              <span>사업 연결</span>
              <select aria-label="사업 연결" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">사업 연결 안 함</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}{project.clientName ? ` · ${project.clientName}` : ''}
                  </option>
                ))}
              </select>
              {selectedProject ? (
                <small className="linked-project-preview">
                  {selectedProject.currentStage} · {selectedProject.clientName ?? '발주처 미지정'}
                </small>
              ) : null}
            </label>
          ) : (
            <>
              <label className="form-field form-field-wide">
                <span>사업명</span>
                <input aria-label="사업명" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="사업과 연결하면 일정 추적이 쉬워집니다." />
              </label>

              <label className="form-field form-field-wide">
                <span>발주처</span>
                <input aria-label="발주처" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="예: 국가철도공단" />
              </label>
            </>
          )}

          {projectLoadError ? <p className="form-error" role="alert">{projectLoadError}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <footer className="quick-dialog-footer">
            <span className="dialog-hint">Esc로 닫기 · 날짜를 더블클릭해도 바로 등록</span>
            <div>
              <button type="button" className="secondary-action" onClick={onClose} disabled={isSaving}>취소</button>
              <button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? '저장 중…' : '저장'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
