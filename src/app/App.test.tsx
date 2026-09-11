import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toDateKey } from '../domain/date';
import { App } from './App';

describe('CalendarForwork application shell', () => {
  test('renders the product title and primary work navigation', async () => {
    render(<App />);
    await screen.findByRole('grid', { name: '월간 일정' });

    const navigation = screen.getByLabelText('주요 메뉴');
    expect(screen.getByText('CalendarForwork')).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: '오늘' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: '캘린더' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: '사업관리' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: '설정' })).toBeInTheDocument();
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

  test('navigates from the calendar to the today work dashboard', async () => {
    render(<App />);
    await screen.findByRole('grid', { name: '월간 일정' });

    const navigation = screen.getByLabelText('주요 메뉴');
    fireEvent.click(within(navigation).getByRole('button', { name: '오늘' }));

    expect(await screen.findByRole('heading', { name: '오늘의 업무' })).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: '월간 일정' })).not.toBeInTheDocument();
  });

  test('navigates to the project and client master workspaces', async () => {
    render(<App />);
    await screen.findByRole('grid', { name: '월간 일정' });
    const navigation = screen.getByLabelText('주요 메뉴');

    fireEvent.click(within(navigation).getByRole('button', { name: '사업관리' }));
    expect(await screen.findByRole('heading', { name: '사업 Master' })).toBeInTheDocument();
    expect(screen.getByText('가상 A철도 차량기지 건설공사')).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole('button', { name: '발주처' }));
    expect(await screen.findByRole('heading', { name: '발주처 Master' })).toBeInTheDocument();
    expect(screen.getByText('가상 공공 발주처 A')).toBeInTheDocument();
  });
});
