import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/useAuth';
import { makePet, makePublication, owner, renderApp } from '../test/utils';

describe('HomePage', () => {
  it('lists active publications with only the owner alias and applies filters', async () => {
    const pubs = [makePublication(), makePublication({ id: 'pub2', commune: 'Maipú', pet: makePet({ id: 'p2', name: 'Michi', species: 'cat' }) })];
    const { calls } = renderApp('/', { 'GET /publications': { body: pubs } });
    expect(await screen.findByText('Toby')).toBeInTheDocument();
    expect(screen.getByTestId('publication-grid').children).toHaveLength(2);
    expect(screen.getAllByTestId('owner-alias')[0]).toHaveTextContent('ownerA');
    expect(document.body.textContent).not.toContain(owner.email);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Filter by commune'), 'Providencia');
    await user.selectOptions(screen.getByLabelText('Filter by species'), 'dog');
    await waitFor(() => expect(calls[calls.length - 1].path).toBe('/publications?commune=Providencia&species=dog'));
    await user.selectOptions(screen.getByLabelText('Filter by commune'), '');
    await waitFor(() => expect(calls[calls.length - 1].path).toBe('/publications?species=dog'));
  });

  it('shows the empty state', async () => {
    renderApp('/', { 'GET /publications': { body: [] } });
    expect(await screen.findByText(/no active publications/i)).toBeInTheDocument();
  });

  it('shows API errors', async () => {
    renderApp('/', { 'GET /publications': { status: 500, body: { message: 'Database down' } } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Database down');
  });

  it('renders a not-found page for unknown routes', () => {
    renderApp('/nope');
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });
});

describe('auth flows', () => {
  it('useAuth throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });

  it('redirects anonymous users from protected pages to login', async () => {
    renderApp('/my-pets');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('drops an invalid stored token', async () => {
    renderApp('/history', { 'GET /users/me': { status: 401, body: { message: 'Unauthorized' } } }, { token: 'bad' });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(localStorage.getItem('lp.token')).toBeNull();
  });

  it('logs in and follows the next parameter', async () => {
    const user = userEvent.setup();
    const { calls } = renderApp('/login?next=%2Fhistory', {
      'POST /auth/login': (c) =>
        c.body?.password === 'secret123'
          ? { status: 201, body: { accessToken: 'tok', user: owner } }
          : { status: 401, body: { message: 'Invalid credentials' } },
      'GET /publications/mine': { body: [] },
    });
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email and password are required');
    await user.type(screen.getByLabelText('Email'), owner.email);
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'My publications' })).toBeInTheDocument();
    expect(localStorage.getItem('lp.token')).toBe('tok');
    expect(calls.some((c) => c.path === '/auth/login')).toBe(true);
  });

  it('logs in without next and lands on home, then logs out', async () => {
    const user = userEvent.setup();
    renderApp('/login', {
      'POST /auth/login': { status: 201, body: { accessToken: 'tok', user: owner } },
      'GET /publications': { body: [] },
    });
    await user.type(screen.getByLabelText('Email'), owner.email);
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByTestId('current-alias')).toHaveTextContent('ownerA');
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(localStorage.getItem('lp.token')).toBeNull();
  });

  it('validates and submits registration', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { calls } = renderApp('/register', {
      'POST /auth/register': () =>
        ++attempts === 1
          ? { status: 409, body: { message: 'Email already registered' } }
          : { status: 201, body: { accessToken: 'tok', user: owner } },
      'GET /pets': { body: [] },
    });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    for (const msg of [/alias must be/i, 'Name is required', 'A valid email is required', 'A valid phone is required', 'Commune is required', /password must/i])
      expect(screen.getByText(msg)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Alias (public)'), owner.alias);
    await user.type(screen.getByLabelText('Full name'), owner.name);
    await user.type(screen.getByLabelText('Email'), owner.email);
    await user.type(screen.getByLabelText('Phone'), owner.phone);
    await user.selectOptions(screen.getByLabelText('Commune'), owner.commune);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('heading', { name: 'My pets' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/auth/register')?.body).toMatchObject({ alias: owner.alias, commune: owner.commune });
  });

  it('shows the unread notifications badge', async () => {
    renderApp('/', { 'GET /publications': { body: [] }, 'GET /notifications/unread-count': { body: { count: 3 } } }, { token: 'tok' });
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('3');
  });
});
