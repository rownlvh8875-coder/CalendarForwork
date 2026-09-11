import { FormEvent, useState } from 'react';
import type { Client, NewClient } from '../../domain/clients';
import type { ClientRepository } from '../../repositories/ClientRepository';

interface Props {
  repository: ClientRepository;
  client?: Client | null;
  onClose: () => void;
  onSaved: (client: Client) => void;
  onDeleted?: (id: string) => void;
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function ClientEditorDialog({ repository, client, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(client?.name ?? '');
  const [category, setCategory] = useState(client?.category ?? '');
  const [department, setDepartment] = useState(client?.department ?? '');
  const [contactName, setContactName] = useState(client?.contactName ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [memo, setMemo] = useState(client?.memo ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = client ? '발주처 수정' : '발주처 등록';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('발주처명을 입력해 주세요.');
      return;
    }

    const input: NewClient = {
      name: name.trim(),
      category: optional(category),
      department: optional(department),
      contactName: optional(contactName),
      phone: optional(phone),
      email: optional(email),
      memo: optional(memo),
    };

    try {
      setSaving(true);
      setError(null);
      const saved = client ? await repository.update(client.id, input) : await repository.create(input);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '발주처 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!client) return;
    try {
      setSaving(true);
      setError(null);
      await repository.remove(client.id);
      onDeleted?.(client.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '발주처 삭제 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="master-editor-dialog client-editor-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="quick-dialog-header">
          <div>
            <span className="dialog-eyebrow">CLIENT MASTER</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={`${title} 닫기`} onClick={onClose}>×</button>
        </header>

        <form className="master-editor-form" onSubmit={handleSubmit}>
          <div className="form-two-columns">
            <label className="form-field master-field-wide"><span>발주처명 <em>*</em></span><input aria-label="발주처명" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label>
            <label className="form-field"><span>구분</span><input aria-label="구분" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="공공기관 / 지자체 / 공기업" /></label>
            <label className="form-field"><span>부서</span><input aria-label="부서" value={department} onChange={(event) => setDepartment(event.target.value)} /></label>
            <label className="form-field"><span>담당자</span><input aria-label="발주처 담당자" value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
            <label className="form-field"><span>연락처</span><input aria-label="연락처" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label className="form-field master-field-wide"><span>이메일</span><input aria-label="이메일" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          </div>
          <label className="form-field"><span>메모</span><textarea aria-label="발주처 메모" value={memo} onChange={(event) => setMemo(event.target.value)} rows={4} /></label>

          {confirmingDelete ? (
            <div className="delete-confirmation" role="alert">
              <strong>발주처 삭제 확인</strong>
              <p>이 발주처를 삭제하면 연결된 사업의 발주처 연결이 해제됩니다. 사업과 일정 자체는 삭제되지 않습니다.</p>
              <div>
                <button type="button" className="secondary-action" onClick={() => setConfirmingDelete(false)}>취소</button>
                <button type="button" className="danger-action" aria-label="삭제 확인" onClick={() => void handleDelete()} disabled={saving}>삭제 확인</button>
              </div>
            </div>
          ) : null}

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <footer className="quick-dialog-footer master-editor-footer">
            <div>{client && !confirmingDelete ? <button type="button" className="text-danger-action" aria-label="발주처 삭제" onClick={() => setConfirmingDelete(true)}>발주처 삭제</button> : null}</div>
            <div>
              <button type="button" className="secondary-action" onClick={onClose}>취소</button>
              <button type="submit" className="primary-action" disabled={saving || confirmingDelete}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
