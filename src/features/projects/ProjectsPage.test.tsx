import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRuntimeMasterRepositories } from '../../repositories/runtimeMasterRepositories';
import { ProjectsPage } from './ProjectsPage';

const anchor = new Date('2026-09-11T09:00:00+09:00');

function renderPage() {
  const repositories = createRuntimeMasterRepositories(anchor, false);
  render(
    <ProjectsPage
      projectRepository={repositories.projects}
      clientRepository={repositories.clients}
      now={anchor}
    />,
  );
  return repositories;
}

describe('ProjectsPage', () => {
  it('renders compact project rows with stage, client and KRW cost', async () => {
    renderPage();
    expect(await screen.findByText('가상 A철도 차량기지 건설공사')).toBeInTheDocument();
    expect(screen.getByText('가상 공공 발주처 A')).toBeInTheDocument();
    expect(screen.getByText('PQ')).toBeInTheDocument();
    expect(screen.getByText('3,200억원')).toBeInTheDocument();
  });

  it('filters locally by search text and stage', async () => {
    renderPage();
    await screen.findByText('가상 A철도 차량기지 건설공사');

    fireEvent.change(screen.getByRole('searchbox', { name: '사업 검색' }), { target: { value: '항만' } });
    expect(screen.queryByText('가상 A철도 차량기지 건설공사')).not.toBeInTheDocument();
    expect(screen.getByText('가상 B항만 개발사업')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('사업단계 필터'), { target: { value: 'pq' } });
    expect(screen.getByText('필터 조건에 맞는 사업이 없습니다.')).toBeInTheDocument();
  });

  it('opens a right detail panel from a row', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('가상 A철도 차량기지 건설공사'));
    expect(screen.getByRole('complementary', { name: '사업 상세' })).toBeInTheDocument();
    expect(screen.getByText('DEMO-A')).toBeInTheDocument();
  });

  it('creates a project from the editor and refreshes the table', async () => {
    renderPage();
    await screen.findByText('가상 A철도 차량기지 건설공사');
    fireEvent.click(screen.getByRole('button', { name: '사업 등록' }));

    fireEvent.change(screen.getByLabelText('사업명'), { target: { value: '가상 신규 도로사업' } });
    fireEvent.change(screen.getByLabelText('현재단계'), { target: { value: 'planning' } });
    fireEvent.change(screen.getByLabelText('중요도'), { target: { value: 'normal' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(screen.getByText('가상 신규 도로사업')).toBeInTheDocument());
  });
});
