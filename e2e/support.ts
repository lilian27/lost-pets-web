import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { expect, request as pwRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
export const EVIDENCE_DIR = path.resolve('docs/evidence');

// 1x1 transparent PNG
export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
export const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`;
const FIXTURES = path.resolve('e2e/fixtures');
export const fixturePng = (name: 'dog' | 'cat' | 'sighting') => ({
  name: `${name}.png`,
  mimeType: 'image/png',
  buffer: fs.readFileSync(path.join(FIXTURES, `${name}.png`)),
});
export const fixtureDataUrl = (name: 'dog' | 'cat' | 'sighting') =>
  `data:image/png;base64,${fixturePng(name).buffer.toString('base64')}`;
export const TWO_MB = 2 * 1024 * 1024;
export const bigPng = () => {
  const buffer = Buffer.alloc(TWO_MB + 1);
  Buffer.from(PNG_BASE64, 'base64').copy(buffer);
  return { name: 'huge.png', mimeType: 'image/png', buffer };
};
export const BIG_PNG_DATA_URL = `data:image/png;base64,${bigPng().buffer.toString('base64')}`;

export interface Person {
  alias: string;
  name: string;
  email: string;
  phone: string;
  commune: string;
  password: string;
  token?: string;
  id?: string;
}

export function makePerson(tag: string, commune = 'Providencia'): Person {
  const n = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return {
    alias: `${tag}_${n}`,
    name: `${tag} Realname ${n}`,
    email: `${tag.toLowerCase()}.${n}@example.com`,
    phone: `+569${String(10000000 + Math.floor(Math.random() * 89999999))}`,
    commune,
    password: 'secret123',
  };
}

export async function api() {
  return pwRequest.newContext({ baseURL: API_URL });
}

export async function registerViaApi(p: Person): Promise<Person> {
  const ctx = await api();
  const { password, alias, name, email, phone, commune } = p;
  const res = await ctx.post('/auth/register', { data: { alias, name, email, phone, commune, password } });
  expect(res.status()).toBe(201);
  const body = await res.json();
  await ctx.dispose();
  return { ...p, token: body.accessToken, id: body.user.id };
}

export async function call(method: string, url: string, token?: string, data?: unknown) {
  const ctx = await api();
  const res = await ctx.fetch(url, {
    method,
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const status = res.status();
  const text = await res.text();
  await ctx.dispose();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status, body: body as Record<string, unknown> & unknown[], text };
}

/** Opens an isolated browser context (own video; Playwright's trace: 'on' covers it) optionally signed in. */
export class Actors {
  private contexts: BrowserContext[] = [];
  constructor(
    private browser: Browser,
    private info: TestInfo,
  ) {}

  async open(label: string, token?: string, viewport = { width: 1280, height: 800 }): Promise<Page> {
    const ctx = await this.browser.newContext({
      baseURL: this.info.project.use.baseURL,
      viewport,
      recordVideo: { dir: this.info.outputPath(`video-${label}`), size: viewport },
    });
    if (token) await ctx.addInitScript((t) => localStorage.setItem('lp.token', t), token);
    (ctx as BrowserContext & { label?: string }).label = label;
    this.contexts.push(ctx);
    return ctx.newPage();
  }

  async closeAll() {
    for (const ctx of this.contexts) {
      const label = (ctx as BrowserContext & { label?: string }).label ?? 'actor';
      const pages = ctx.pages();
      await ctx.close();
      for (const page of pages) {
        const video = await page.video()?.path();
        if (video) await this.info.attach(`video-${label}`, { path: video, contentType: 'video/webm' });
      }
    }
    this.contexts = [];
  }
}

export async function snap(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(name, { path: file, contentType: 'image/png' });
}

/** Records every API response body seen by a page so we can assert on leaked PII. */
export function captureApiTraffic(page: Page) {
  const bodies: string[] = [];
  page.on('response', async (res) => {
    if (!res.url().startsWith(API_URL)) return;
    try {
      bodies.push(await res.text());
    } catch {
      /* body unavailable (e.g. redirects) */
    }
  });
  return bodies;
}

export function expectNoPii(haystack: string, owner: Person) {
  for (const secret of [owner.email, owner.phone, owner.name]) {
    expect(haystack, `must not expose ${secret}`).not.toContain(secret);
  }
}
