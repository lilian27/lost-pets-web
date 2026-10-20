import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import type { Comment, Pet, Publication, User } from '../api/types';

export const NOW = '2026-10-20T12:00:00.000Z';
export const PNG = 'data:image/png;base64,iVBORw0KGgo=';

export const owner: User = {
  id: 'u1',
  alias: 'ownerA',
  name: 'Ana Real',
  email: 'ana@example.com',
  phone: '+56911111111',
  commune: 'Providencia',
};

export const makePet = (o: Partial<Pet> = {}): Pet => ({
  id: 'p1',
  name: 'Toby',
  species: 'dog',
  sex: 'male',
  size: 'medium',
  color: null,
  vaccines: null,
  description: null,
  photo: PNG,
  createdAt: NOW,
  ...o,
});

export const makePublication = (o: Partial<Publication> = {}): Publication => ({
  id: 'pub1',
  status: 'active',
  commune: 'Providencia',
  description: null,
  lastSeenAddress: null,
  lostAt: NOW,
  foundAt: null,
  createdAt: NOW,
  owner: { id: 'u1', alias: 'ownerA' },
  pet: makePet(),
  isOwner: false,
  ...o,
});

export const makeComment = (o: Partial<Comment> = {}): Comment => ({
  id: 'c1',
  publicationId: 'pub1',
  type: 'comment',
  text: 'Hello there',
  photo: null,
  isAnonymous: false,
  authorName: 'userC',
  author: { id: 'u3', alias: 'userC' },
  flagCount: 0,
  flagged: false,
  flaggedByMe: false,
  edited: false,
  editedAt: null,
  createdAt: NOW,
  canEdit: false,
  ...o,
});

export interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}
type Reply = { status?: number; body?: unknown };
export type Routes = Record<string, Reply | ((call: Call) => Reply)>;

export function mockApi(routes: Routes): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? 'GET';
      const call: Call = {
        method,
        path: u.pathname + u.search,
        body: init.body ? JSON.parse(init.body as string) : undefined,
        headers: (init.headers ?? {}) as Record<string, string>,
      };
      calls.push(call);
      const route = routes[`${method} ${call.path}`] ?? routes[`${method} ${u.pathname}`];
      const reply = typeof route === 'function' ? route(call) : route;
      if (!reply) return new Response(JSON.stringify({ message: `No mock for ${method} ${call.path}` }), { status: 500 });
      return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status ?? 200 });
    }),
  );
  return calls;
}

export function renderApp(path: string, routes: Routes = {}, { token }: { token?: string } = {}) {
  if (token) localStorage.setItem('lp.token', token);
  const calls = mockApi({
    'GET /users/me': { body: owner },
    'GET /notifications/unread-count': { body: { count: 0 } },
    ...routes,
  });
  const view = render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
  return { calls, ...view };
}
