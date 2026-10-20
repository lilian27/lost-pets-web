import type {
  AuthSession,
  Comment,
  CommentInput,
  Notification,
  Pet,
  PetInput,
  Publication,
  PublicationFilters,
  PublicationInput,
  PublicationStatus,
  RegisterInput,
  User,
} from './types';

export const API_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

const TOKEN_KEY = 'lp.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function parse(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function request<T>(
  path: string,
  { method = 'GET', body, headers = {} }: RequestOptions = {},
): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = parse(await res.text()) as { message?: string | string[] } | null;
  if (!res.ok) {
    const raw = data?.message;
    const message = Array.isArray(raw) ? raw.join('. ') : raw || res.statusText;
    throw new ApiError(res.status, message || `Request failed (${res.status})`);
  }
  return data as T;
}

function query(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const api = {
  register: (input: RegisterInput) =>
    request<AuthSession>('/auth/register', { method: 'POST', body: input }),
  login: (email: string, password: string) =>
    request<AuthSession>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  me: () => request<User>('/users/me'),

  listPets: () => request<Pet[]>('/pets'),
  createPet: (input: PetInput) =>
    request<Pet>('/pets', { method: 'POST', body: input }),

  listPublications: (filters: PublicationFilters = {}) =>
    request<Publication[]>(
      `/publications${query({ commune: filters.commune, species: filters.species })}`,
    ),
  myPublications: () => request<Publication[]>('/publications/mine'),
  getPublication: (id: string) => request<Publication>(`/publications/${id}`),
  createPublication: (input: PublicationInput) =>
    request<Publication>('/publications', { method: 'POST', body: input }),
  updatePublicationStatus: (id: string, status: PublicationStatus) =>
    request<Publication>(`/publications/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),

  listComments: (publicationId: string) =>
    request<Comment[]>(`/publications/${publicationId}/comments`),
  createComment: (publicationId: string, input: CommentInput) =>
    request<Comment>(`/publications/${publicationId}/comments`, {
      method: 'POST',
      body: input,
    }),
  updateComment: (id: string, text: string, editToken?: string) =>
    request<Comment>(`/comments/${id}`, {
      method: 'PATCH',
      body: { text },
      headers: editToken ? { 'X-Edit-Token': editToken } : {},
    }),
  flagComment: (id: string) =>
    request<Comment>(`/comments/${id}/flag`, { method: 'POST' }),

  listNotifications: () => request<Notification[]>('/notifications'),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request<{ updated: number }>('/notifications/read-all', { method: 'PATCH' }),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}
