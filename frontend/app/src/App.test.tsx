import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('shows the display name gate before listing sales', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App />);
    expect(screen.getByText('Enter your name')).toBeDefined();
  });
});