import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRuntimeMasterRepositories } from '../../repositories/runtimeMasterRepositories';
import { ClientsPage } from './ClientsPage';

const anchor = new Date('2026-09-11T09:00:00+09:00');

function renderPage() {
  const repositories = createRuntimeMasterRepositories(anchor, false);
  render(
    <ClientsPage
      clientRepository={repositories.clients}
      projectRepository={repositories.projects}
    />,
  );
  return repositories;
}

describe('ClientsPage', () => {
  it('renders compact client rows and filters by search/category', async () => {
    renderPage();
    expect(await screen.findByText('가상 공공 발주처 A')).toBeInTheDocument();
    expect(screen.getByText('사업관리부')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: '발주처 검색' }), { target: { value: 'B' } });
    expect(screen.queryByText('가상 공공 발주처 A')).not.toBeInTheDocument();
    expect(screen.getByText('가상 공공 발주처 B')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('발주처 구분 필터'), { target: { value: '공공기관' } });
    expect(screen.getByText('가상 공공 발주처 B')).toBeInTheDocument();
  });

  it('counts only projects that are actually linked to a client', async () => {
    const repositories = createRuntimeMasterRepositories(anchor, false);
    await repositories.projects.create({
      projectCode: 'NO-CLIENT',
      name: '가상 발주처 미지정 사업',
      clientId: null,
      projectType: '도로',
      region: '서울',
      contractType: null,
      estimatedCost: null,
      currentStage: 'interest',
      priority: 'normal',
      assignee: null,
      expectedBidDate: null,
      description: null,
      memo: null,
      url: null,
      archived: false,
    });

    render(
      <ClientsPage
        clientRepository={repositories.clients}
        projectRepository={repositories.projects}
      />,
    );

    const summary = await screen.findByLabelText('발주처 요약');
    expect(within(summary).getByText('연결 사업').parentElement).toHaveTextContent('연결 사업2');
  });

  it('creates a new client and refreshes the list', async () => {
    renderPage();
    await screen.findByText('가상 공공 발주처 A');
    fireEvent.click(screen.getByRole('button', { name: '발주처 등록' }));

    fireEvent.change(screen.getByLabelText('발주처명'), { target: { value: '가상 신규 발주처' } });
    fireEvent.change(screen.getByLabelText('구분'), { target: { value: '지자체' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(screen.getByText('가상 신규 발주처')).toBeInTheDocument());
  });

  it('opens an existing client editor without leaving the list', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('가상 공공 발주처 A'));

    expect(screen.getByRole('dialog', { name: '발주처 수정' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '발주처 목록' })).toBeInTheDocument();
  });

  it('requires confirmation before deleting and preserves linked projects', async () => {
    const repositories = renderPage();
    fireEvent.click(await screen.findByText('가상 공공 발주처 A'));
    fireEvent.click(screen.getByRole('button', { name: '발주처 삭제' }));

    expect(screen.getByText('이 발주처를 삭제하면 연결된 사업의 발주처 연결이 해제됩니다. 사업과 일정 자체는 삭제되지 않습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }));

    await waitFor(() => expect(screen.queryByText('가상 공공 발주처 A')).not.toBeInTheDocument());
    const linkedProject = await repositories.projects.get('demo-project-a');
    expect(linkedProject?.clientId).toBeNull();
  });
});
