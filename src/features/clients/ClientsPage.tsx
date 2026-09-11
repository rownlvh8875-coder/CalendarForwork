import { useEffect, useMemo, useState } from 'react';
import type { Client } from '../../domain/clients';
import type { Project } from '../../domain/projects';
import type { ClientRepository } from '../../repositories/ClientRepository';
import type { ProjectRepository } from '../../repositories/ProjectRepository';
import { ClientEditorDialog } from './ClientEditorDialog';

interface Props {
  clientRepository: ClientRepository;
  projectRepository: ProjectRepository;
}

export function ClientsPage({ clientRepository, projectRepository }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState<Client | 'new' | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [nextClients, nextProjects] = await Promise.all([
        clientRepository.list(),
        projectRepository.list(false),
      ]);
      setClients(nextClients);
      setProjects(nextProjects);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '발주처 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientRepository, projectRepository]);

  const categories = useMemo(
    () => [...new Set(clients.map((client) => client.category).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ko-KR')),
    [clients],
  );

  const projectCountByClient = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      if (!project.clientId) continue;
      counts.set(project.clientId, (counts.get(project.clientId) ?? 0) + 1);
    }
    return counts;
  }, [projects]);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    return clients.filter((client) => {
      if (categoryFilter !== 'all' && client.category !== categoryFilter) return false;
      if (!normalized) return true;
      const haystack = [
        client.name,
        client.category,
        client.department,
        client.contactName,
        client.phone,
        client.email,
      ].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
      return haystack.includes(normalized);
    });
  }, [clients, query, categoryFilter]);

  function handleSaved() {
    setEditing(null);
    void load();
  }

  function handleDeleted() {
    setEditing(null);
    void load();
  }

  const noClients = !loading && !error && clients.length === 0;
  const noFilterResult = !loading && !error && clients.length > 0 && filteredClients.length === 0;

  return (
    <div className="master-page client-master-page">
      <section className="master-summary-strip client-summary-strip" aria-label="발주처 요약">
        <div className="master-summary-item"><span>등록 발주처</span><strong>{clients.length}</strong></div>
        <div className="master-summary-item"><span>연결 사업</span><strong>{projects.length}</strong></div>
        <div className="master-summary-item"><span>발주처 구분</span><strong>{categories.length}</strong></div>
        <div className="master-summary-item master-summary-cost"><span>연락처 등록</span><strong>{clients.filter((client) => client.phone || client.email).length}</strong></div>
      </section>

      <section className="master-workspace">
        <div className="master-list-pane">
          <div className="master-toolbar">
            <div className="master-toolbar-copy">
              <h2>발주처 Master</h2>
              <span>{filteredClients.length.toLocaleString('ko-KR')}건 표시</span>
            </div>
            <div className="master-toolbar-controls">
              <label className="master-search">
                <span aria-hidden="true">⌕</span>
                <input type="search" aria-label="발주처 검색" placeholder="발주처·부서·담당자 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <select className="master-filter" aria-label="발주처 구분 필터" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">전체 구분</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <button type="button" className="primary-action" aria-label="발주처 등록" onClick={() => setEditing('new')}>+ 발주처 등록</button>
            </div>
          </div>

          {error ? <div className="master-state master-state-error" role="alert">{error}</div> : null}
          {loading ? <div className="master-state">발주처 정보를 불러오는 중입니다.</div> : null}
          {noClients ? <div className="master-state"><strong>등록된 발주처가 없습니다.</strong><span>발주처를 등록하면 사업과 일정에서 반복 입력하지 않고 연결할 수 있습니다.</span></div> : null}
          {noFilterResult ? <div className="master-state"><strong>필터 조건에 맞는 발주처가 없습니다.</strong><span>검색어나 구분 필터를 변경해 보세요.</span></div> : null}

          {!loading && !error && filteredClients.length > 0 ? (
            <div className="master-table-scroll">
              <table className="master-table client-table" aria-label="발주처 목록">
                <thead>
                  <tr><th>발주처명</th><th>구분</th><th>부서</th><th>담당자</th><th>연락처</th><th>이메일</th><th className="numeric">연결사업</th></tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id} tabIndex={0} onClick={() => setEditing(client)} onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setEditing(client);
                      }
                    }}>
                      <td className="client-name-cell"><strong>{client.name}</strong><span>{client.memo ? '메모 있음' : '메모 없음'}</span></td>
                      <td><span className="status-badge client-category-badge">{client.category ?? '미분류'}</span></td>
                      <td>{client.department ?? '-'}</td>
                      <td>{client.contactName ?? '-'}</td>
                      <td>{client.phone ?? '-'}</td>
                      <td className="client-email-cell">{client.email ?? '-'}</td>
                      <td className="numeric"><strong className="linked-project-count">{projectCountByClient.get(client.id) ?? 0}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {editing ? (
        <ClientEditorDialog
          repository={clientRepository}
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
