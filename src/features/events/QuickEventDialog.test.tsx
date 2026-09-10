import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryEventRepository } from '../../repositories/memoryEventRepository';
import { QuickEventDialog } from './QuickEventDialog';

describe('QuickEventDialog', () => {
  test('requires an event title before saving', async () => {
    const repository = createMemoryEventRepository([]);

    render(
      <QuickEventDialog
        repository={repository}
        initialDateKey="2026-09-10"
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('일정명을 입력하세요.')).toBeInTheDocument();
    expect(await repository.listBetween('2026-09-10', '2026-09-10')).toHaveLength(0);
  });

  test('creates an event with date, category and priority', async () => {
    const repository = createMemoryEventRepository([]);
    const onCreated = vi.fn();

    render(
      <QuickEventDialog
        repository={repository}
        initialDateKey="2026-09-10"
        onClose={() => undefined}
        onCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText('일정명'), { target: { value: 'PQ 제출서류 최종 점검' } });
    fireEvent.change(screen.getByLabelText('사업명'), { target: { value: 'A철도 차량기지 건설공사' } });
    fireEvent.change(screen.getByLabelText('발주처'), { target: { value: '국가철도공단' } });
    fireEvent.change(screen.getByLabelText('구분'), { target: { value: 'pq' } });
    fireEvent.change(screen.getByLabelText('중요도'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('마감시간'), { target: { value: '17:00' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const stored = await repository.listBetween('2026-09-10', '2026-09-10');

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      title: 'PQ 제출서류 최종 점검',
      projectName: 'A철도 차량기지 건설공사',
      clientName: '국가철도공단',
      categoryKey: 'pq',
      categoryName: 'PQ',
      priority: 'high',
    });
    expect(stored[0].deadlineAt).toContain('2026-09-10T17:00:00');
  });
});
