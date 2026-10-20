import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App';
import { mockApi } from './test/utils';

it('mounts the full app with the browser router', async () => {
  mockApi({ 'GET /publications': { body: [] } });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Lost pets' })).toBeInTheDocument();
});
