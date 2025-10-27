import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders dashboard navigation button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });
});
