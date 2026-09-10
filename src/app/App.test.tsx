import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('CalendarForwork application shell', () => {
  test('renders the product title', () => {
    render(<App />);
    expect(screen.getByText('CalendarForwork')).toBeInTheDocument();
  });
});
