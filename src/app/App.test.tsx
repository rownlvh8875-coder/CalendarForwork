import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toDateKey } from '../domain/date';
import { App } from './App';

describe('CalendarForwork application shell', () => {
  test('renders the product title and primary work navigation', () => {
    render(<App />);

    expect(screen.getByText('CalendarForwork')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '오늘' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '캘린더' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사업관리' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일정 등록' })).toBeInTheDocument();
  });

  test('opens quick add and reflects the saved event in the visible calendar', async () => {
    render(<App />);
    await screen.findByRole('grid', { name: '월간 일정' });

    fireEvent.click(screen.getByRole('button', { name: '일정 등록' }));
    const dialog = await screen.findByRole('dialog', { name: '빠른 일정 등록' });

    expect(screen.getByLabelText('날짜')).toHaveValue(toDateKey(new Date()));
    fireEvent.change(screen.getByLabelText('일정명'), { target: { value: '통합흐름 확인 일정' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(await screen.findByText('통합흐름 확인 일정')).toBeInTheDocument();
  });
});
