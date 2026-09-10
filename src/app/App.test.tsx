import { render, screen } from '@testing-library/react';
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
});
