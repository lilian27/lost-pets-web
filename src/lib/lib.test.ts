import { describe, expect, it, vi } from 'vitest';
import { API_URL, ApiError, api, errorMessage, request, tokenStore } from '../api/client';
import { mockApi } from '../test/utils';
import { editTokens } from './editTokens';
import { formatDateTime } from './format';
import { PHOTO_NOT_IMAGE, PHOTO_TOO_LARGE, fileToDataUrl, validatePhoto } from './image';

describe('api client', () => {
  it('defaults to the local API', () => {
    expect(API_URL).toBe('http://localhost:3000');
  });

  it('sends JSON body and bearer token', async () => {
    tokenStore.set('tok');
    const calls = mockApi({ 'POST /pets': { status: 201, body: { id: 'p1' } } });
    await expect(request('/pets', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ id: 'p1' });
    expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
    expect(calls[0].body).toEqual({ a: 1 });
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });

  it('builds publication filter query strings', async () => {
    const calls = mockApi({ 'GET /publications': { body: [] } });
    await api.listPublications();
    await api.listPublications({ commune: 'Maipú', species: 'cat' });
    expect(calls.map((c) => c.path)).toEqual(['/publications', '/publications?commune=Maip%C3%BA&species=cat']);
  });

  it('sends the anonymous edit token header', async () => {
    const calls = mockApi({ 'PATCH /comments/c1': { body: {} } });
    await api.updateComment('c1', 'x', 'secret');
    await api.updateComment('c1', 'y');
    expect(calls[0].headers['X-Edit-Token']).toBe('secret');
    expect(calls[1].headers['X-Edit-Token']).toBeUndefined();
  });

  it('turns error payloads into ApiError messages', async () => {
    mockApi({
      'GET /a': { status: 400, body: { message: ['text too long', 'type invalid'] } },
      'GET /b': { status: 409, body: { message: 'exists' } },
      'GET /c': { status: 500 },
    });
    await expect(request('/a')).rejects.toMatchObject({ status: 400, message: 'text too long. type invalid' });
    await expect(request('/b')).rejects.toBeInstanceOf(ApiError);
    await expect(request('/c')).rejects.toThrow('Request failed (500)');
  });

  it('falls back to statusText and tolerates non-JSON bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502, statusText: 'Bad Gateway' })));
    await expect(request('/x')).rejects.toThrow('Bad Gateway');
  });

  it('errorMessage handles non-errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('nope')).toBe('Unexpected error');
  });
});

describe('editTokens', () => {
  it('stores and reads tokens', () => {
    expect(editTokens.get('c1')).toBeUndefined();
    editTokens.set('c1', 't1');
    expect(editTokens.get('c1')).toBe('t1');
  });
  it('ignores corrupted storage', () => {
    localStorage.setItem('lp.editTokens', '{bad');
    expect(editTokens.get('c1')).toBeUndefined();
  });
});

describe('image helpers', () => {
  it('validates type and size', () => {
    expect(validatePhoto(new File(['x'], 'a.txt', { type: 'text/plain' }))).toBe(PHOTO_NOT_IMAGE);
    expect(validatePhoto(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }))).toBe(PHOTO_TOO_LARGE);
    expect(validatePhoto(new File([new Uint8Array(2 * 1024 * 1024)], 'a.png', { type: 'image/png' }))).toBeNull();
  });
  it('converts files to data URLs', async () => {
    await expect(fileToDataUrl(new File(['hi'], 'a.png', { type: 'image/png' }))).resolves.toBe('data:image/png;base64,aGk=');
  });
  it('rejects when the file cannot be read', async () => {
    class FailingReader {
      error = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onerror?.());
      }
    }
    vi.stubGlobal('FileReader', FailingReader);
    await expect(fileToDataUrl(new File(['hi'], 'a.png'))).rejects.toThrow('Could not read file');
  });
});

describe('formatDateTime', () => {
  it('formats ISO dates', () => {
    expect(formatDateTime('2026-10-20T12:00:00.000Z')).toMatch(/2026/);
  });
});
