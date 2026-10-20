import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  Actors,
  BIG_PNG_DATA_URL,
  PNG_DATA_URL,
  bigPng,
  call,
  captureApiTraffic,
  expectNoPii,
  makePerson,
  registerViaApi,
  fixtureDataUrl,
  fixturePng,
  snap,
} from './support';
import type { Person } from './support';

test.describe.configure({ mode: 'serial' });

const RUN = Date.now().toString(36).slice(-5);
const TOBY = `Toby-${RUN}`;
const MICHI = `Michi-${RUN}`;
const VACCINES = 'Rabies (2025-03), Octuple (2025-05), deworming monthly';
const userA: Person = makePerson('UserA', 'Providencia');
let userB: Person;
let userC: Person;
let petId = '';
let publicationId = '';
const cat = { petId: '', publicationId: '' };

let actors: Actors;
test.beforeEach(({ browser }, info) => {
  actors = new Actors(browser, info);
});
test.afterEach(async () => {
  await actors.closeAll();
});

async function openPublication(page: Page, id: string) {
  await page.goto(`/publications/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('1. User A registers, adds a pet and publishes a lost report', async ({ page }, info) => {
  await page.goto('/register');
  await page.getByLabel('Alias (public)').fill(userA.alias);
  await page.getByLabel('Full name').fill(userA.name);
  await page.getByLabel('Email').fill(userA.email);
  await page.getByLabel('Phone').fill(userA.phone);
  await page.getByLabel('Commune').selectOption(userA.commune);
  await page.getByLabel('Password').fill(userA.password);
  await snap(page, info, '01a-register-form');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/my-pets$/);
  await expect(page.getByTestId('current-alias')).toHaveText(userA.alias);
  userA.token = (await page.evaluate(() => localStorage.getItem('lp.token'))) ?? undefined;
  expect(userA.token).toBeTruthy();

  await page.getByRole('link', { name: /add pet/i }).first().click();
  await page.getByLabel('Name').fill(TOBY);
  await page.getByLabel('Species').selectOption('dog');
  await page.getByLabel('Sex').selectOption('male');
  await page.getByLabel('Size').selectOption('medium');
  await page.getByLabel('Vaccines (optional)').fill(VACCINES);
  await page.getByLabel('Photo', { exact: true }).setInputFiles(fixturePng('dog'));
  await expect(page.locator('.photo-preview')).toBeVisible();
  await snap(page, info, '01b-add-pet-form');
  await page.getByRole('button', { name: 'Save pet' }).click();
  await expect(page).toHaveURL(/\/my-pets$/);
  const petItem = page.getByTestId('pet-item').filter({ hasText: TOBY });
  await expect(petItem).toContainText('Dog · Male · Medium');
  await expect(petItem).toContainText(VACCINES);

  const pets = await call('GET', '/pets', userA.token);
  petId = (pets.body as unknown as { id: string; name: string }[]).find((p) => p.name === TOBY)!.id;

  const before = Date.now();
  await petItem.getByRole('button', { name: 'Report as lost' }).click();
  await petItem.getByLabel('Commune where lost').selectOption('Providencia');
  await petItem.getByLabel('Last seen near (optional)').fill('Parque Bustamante');
  await petItem.getByRole('button', { name: 'Publish' }).click();
  await expect(page).toHaveURL(/\/publications\/[a-f0-9]{24}$/);
  publicationId = page.url().split('/').pop()!;
  await expect(page.getByTestId('publication-status')).toHaveText('Lost');
  await expect(page.getByTestId('lost-at')).not.toBeEmpty();
  await expect(page.getByTestId('owner-alias')).toHaveText(userA.alias);

  const pub = await call('GET', `/publications/${publicationId}`);
  const lostAt = new Date(pub.body.lostAt as string).getTime();
  expect(lostAt).toBeGreaterThanOrEqual(before - 5_000);
  expect(lostAt).toBeLessThanOrEqual(Date.now() + 5_000);
  await snap(page, info, '01c-publication-created');
});

test('2. A second report for the same pet is blocked with a warning', async ({ browser }, info) => {
  const page = await actors.open('userA', userA.token);
  await page.goto('/my-pets');
  const petItem = page.getByTestId('pet-item').filter({ hasText: TOBY });
  await petItem.getByRole('button', { name: 'Report as lost' }).click();
  await petItem.getByLabel('Commune where lost').selectOption('Providencia');
  await petItem.getByRole('button', { name: 'Publish' }).click();
  await expect(petItem.getByTestId('publish-warning')).toContainText('already has an active publication');
  await expect(page).toHaveURL(/\/my-pets$/);
  await snap(page, info, '02-duplicate-blocked');

  const res = await call('POST', '/publications', userA.token, { petId, commune: 'Providencia' });
  expect(res.status).toBe(409);
  expect(res.text).toContain('active publication');
  const mine = await call('GET', '/publications/mine', userA.token);
  expect((mine.body as unknown as unknown[]).length).toBe(1);
  void browser;
});

test('3. Anonymous visitor sees the 3-column grid, filters work, only alias is exposed', async ({}, info) => {
  // A second active publication (cat, other commune) makes the filters meaningful.
  const catPet = await call('POST', '/pets', userA.token, {
    name: MICHI, species: 'cat', sex: 'female', size: 'small', photo: fixtureDataUrl('cat'),
  });
  cat.petId = catPet.body.id as string;
  const catPub = await call('POST', '/publications', userA.token, { petId: cat.petId, commune: 'Maipú' });
  expect(catPub.status).toBe(201);
  cat.publicationId = catPub.body.id as string;

  const page = await actors.open('anonymous');
  const traffic = captureApiTraffic(page);
  await page.goto('/');
  const grid = page.getByTestId('publication-grid');
  await expect(grid.getByTestId('publication-card').filter({ hasText: TOBY })).toBeVisible();
  const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(3);
  const toby = grid.getByTestId('publication-card').filter({ hasText: TOBY });
  await expect(toby.getByTestId('owner-alias')).toHaveText(userA.alias);
  await snap(page, info, '03a-home-grid');

  await page.getByLabel('Filter by commune').selectOption('Providencia');
  await expect(toby).toBeVisible();
  await expect(grid.getByText(MICHI)).toHaveCount(0);
  for (const commune of await page.getByTestId('card-commune').allTextContents())
    expect(commune).toContain('Providencia');
  await snap(page, info, '03b-filter-commune');

  await page.getByLabel('Filter by commune').selectOption('');
  await page.getByLabel('Filter by species').selectOption('cat');
  await expect(page.getByTestId('publication-card').filter({ hasText: MICHI })).toBeVisible();
  await expect(page.getByTestId('publication-card').filter({ hasText: TOBY })).toHaveCount(0);
  await snap(page, info, '03c-filter-species-cat');
  await page.getByLabel('Filter by species').selectOption('dog');
  await expect(page.getByTestId('publication-card').filter({ hasText: TOBY })).toBeVisible();
  await expect(page.getByTestId('publication-card').filter({ hasText: MICHI })).toHaveCount(0);

  await toby.getByRole('link').first().click();
  await expect(page.getByTestId('owner-alias')).toHaveText(userA.alias);
  await snap(page, info, '03d-detail-alias-only');

  expectNoPii(await page.content(), userA);
  expect(traffic.length).toBeGreaterThan(0);
  expectNoPii(traffic.join('\n'), userA);
  for (const url of ['/publications', `/publications/${publicationId}`, `/publications/${publicationId}/comments`]) {
    expectNoPii((await call('GET', url)).text, userA);
  }
});

test('4. Anonymous sighting with photo + User C possible_finding notify User A', async ({}, info) => {
  userC = await registerViaApi(makePerson('UserC', 'Ñuñoa'));

  const anon = await actors.open('anonymous');
  await openPublication(anon, publicationId);
  await anon.getByLabel('Your name').fill('Neighbor Rosa');
  await anon.getByLabel('Your email (never shown)').fill('rosa.neighbor@example.com');
  await anon.getByLabel('Type').selectOption('sighting');
  await anon.getByLabel('Comment', { exact: true }).fill('Saw a medium brown dog near Parque Bustamante at 9am.');
  await anon.getByLabel('Photo (optional)').setInputFiles(fixturePng('sighting'));
  await anon.getByRole('button', { name: 'Send comment' }).click();
  const sighting = anon.getByTestId('comment').filter({ hasText: 'Neighbor Rosa' });
  await expect(sighting).toHaveAttribute('data-comment-type', 'sighting');
  await expect(sighting.getByRole('img', { name: /photo from neighbor rosa/i })).toBeVisible();
  await expect(anon.getByText('rosa.neighbor@example.com')).toHaveCount(0);
  await snap(anon, info, '04a-anonymous-sighting');

  const c = await actors.open('userC', userC.token);
  await openPublication(c, publicationId);
  await expect(c.getByLabel('Your name')).toHaveCount(0);
  await c.getByLabel('Type').selectOption('possible_finding');
  await c.getByLabel('Comment', { exact: true }).fill('I think this dog is in my backyard right now!');
  await c.getByRole('button', { name: 'Send comment' }).click();
  const finding = c.getByTestId('comment').filter({ hasText: userC.alias });
  await expect(finding).toHaveAttribute('data-comment-type', 'possible_finding');
  await expect(finding.getByTestId('possible-finding-flag')).toBeVisible();
  await snap(c, info, '04b-possible-finding-flag');

  const a = await actors.open('userA', userA.token);
  await a.goto('/');
  await expect(a.getByTestId('notification-badge')).toHaveText('2');
  await snap(a, info, '04c-owner-badge');
  await a.getByRole('link', { name: /notifications \(2 unread\)/i }).click();
  await expect(a.getByTestId('notification')).toHaveCount(2);
  await snap(a, info, '04d-owner-notifications');
});

test('5. Non-owners cannot change publication status', async ({}, info) => {
  const c = await actors.open('userC', userC.token);
  await openPublication(c, publicationId);
  await expect(c.getByRole('button', { name: /mark as found/i })).toHaveCount(0);
  await snap(c, info, '05a-non-owner-no-button');

  const anon = await actors.open('anonymous');
  await openPublication(anon, publicationId);
  await expect(anon.getByRole('button', { name: /mark as found/i })).toHaveCount(0);

  expect((await call('PATCH', `/publications/${publicationId}/status`, userC.token, { status: 'found' })).status).toBe(403);
  expect((await call('PATCH', `/publications/${publicationId}/status`, undefined, { status: 'found' })).status).toBe(401);
  const still = await call('GET', `/publications/${publicationId}`);
  expect(still.body.status).toBe('active');
});

test('6. Owner marks found: hidden from home, visible only in owner history with full thread', async ({}, info) => {
  const a = await actors.open('userA', userA.token);
  await openPublication(a, publicationId);
  await a.getByRole('button', { name: 'Mark as found' }).click();
  await expect(a.getByTestId('publication-status')).toHaveText('Found');
  await snap(a, info, '06a-marked-found');

  const anon = await actors.open('anonymous');
  await anon.goto('/');
  await expect(anon.getByTestId('publication-card').filter({ hasText: MICHI })).toBeVisible();
  await expect(anon.getByTestId('publication-card').filter({ hasText: TOBY })).toHaveCount(0);
  await snap(anon, info, '06b-home-without-found');
  await anon.goto(`/publications/${publicationId}`);
  await expect(anon.getByRole('alert')).toHaveText('Publication not found');

  const c = await actors.open('userC', userC.token);
  await c.goto('/');
  await expect(c.getByTestId('publication-card').filter({ hasText: TOBY })).toHaveCount(0);
  await c.goto(`/publications/${publicationId}`);
  await expect(c.getByRole('alert')).toHaveText('Publication not found');
  expect((await call('GET', '/publications/mine', userC.token)).body).toEqual([]);

  await a.goto('/history');
  const item = a.getByTestId('history-item').filter({ hasText: TOBY });
  await expect(item).toContainText('Found');
  await snap(a, info, '06c-owner-history');
  await item.getByRole('link', { name: TOBY }).click();
  await expect(a.getByTestId('comment')).toHaveCount(2);
  await expect(a.getByTestId('comment').filter({ hasText: 'Neighbor Rosa' })).toBeVisible();
  await expect(a.getByTestId('comment').filter({ hasText: userC.alias })).toBeVisible();
  await snap(a, info, '06d-owner-full-thread');
});

test('7. Comments can be edited, cannot be deleted, and can be flagged offensive', async ({}, info) => {
  userB = await registerViaApi(makePerson('UserB', 'Macul'));
  const c = await actors.open('userC', userC.token);
  await openPublication(c, cat.publicationId);
  await c.getByLabel('Comment', { exact: true }).fill('Seen a cat on Av. Pajaritos');
  await c.getByRole('button', { name: 'Send comment' }).click();
  const mine = c.getByTestId('comment').filter({ hasText: userC.alias });
  await mine.getByRole('button', { name: 'Edit' }).click();
  await mine.getByLabel('Edit comment').fill('Seen a grey cat on Av. Pajaritos 1200');
  await mine.getByRole('button', { name: 'Save' }).click();
  await expect(mine.getByTestId('comment-text')).toHaveText('Seen a grey cat on Av. Pajaritos 1200');
  await expect(mine).toContainText('edited');
  await expect(c.getByRole('button', { name: /delete/i })).toHaveCount(0);
  await snap(c, info, '07a-registered-edit');

  const anon = await actors.open('anonymous');
  await openPublication(anon, cat.publicationId);
  await anon.getByLabel('Your name').fill('Walker Tom');
  await anon.getByLabel('Your email (never shown)').fill('tom.walker@example.com');
  await anon.getByLabel('Comment', { exact: true }).fill('Maybe the same cat');
  await anon.getByRole('button', { name: 'Send comment' }).click();
  const anonComment = anon.getByTestId('comment').filter({ hasText: 'Walker Tom' });
  await anonComment.getByRole('button', { name: 'Edit' }).click();
  await anonComment.getByLabel('Edit comment').fill('Definitely the same cat, it had a red collar');
  await anonComment.getByRole('button', { name: 'Save' }).click();
  await expect(anonComment.getByTestId('comment-text')).toHaveText('Definitely the same cat, it had a red collar');
  await snap(anon, info, '07b-anonymous-edit');

  // Others cannot edit, nobody can delete.
  const b = await actors.open('userB', userB.token);
  await openPublication(b, cat.publicationId);
  const cComment = b.getByTestId('comment').filter({ hasText: userC.alias });
  await expect(cComment.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(b.getByRole('button', { name: /delete/i })).toHaveCount(0);
  const comments = (await call('GET', `/publications/${cat.publicationId}/comments`)).body as unknown as { id: string; authorName: string }[];
  const cId = comments.find((x) => x.authorName === userC.alias)!.id;
  expect((await call('PATCH', `/comments/${cId}`, userB.token, { text: 'hijack' })).status).toBe(403);
  expect((await call('DELETE', `/comments/${cId}`, userC.token)).status).toBe(405);
  expect((await call('DELETE', `/comments/${cId}`, userA.token)).status).toBe(405);

  await cComment.getByRole('button', { name: 'Report offensive' }).click();
  await expect(cComment.getByText('Reported')).toBeVisible();
  await expect(cComment.getByTestId('offensive-flag')).toHaveText('Flagged as offensive (1)');
  await snap(b, info, '07c-flag-offensive');
  const after = (await call('GET', `/publications/${cat.publicationId}/comments`)).body as unknown as { id: string; flagCount: number }[];
  expect(after.find((x) => x.id === cId)!.flagCount).toBe(1);
  expect(after.length).toBe(2);
});

test('8. Boundary checks: limits and required fields are enforced (UI + API)', async ({}, info) => {
  const a = await actors.open('userA', userA.token);

  // Comment > 300 chars
  await openPublication(a, cat.publicationId);
  await a.getByLabel('Comment', { exact: true }).fill('x'.repeat(301));
  await expect(a.getByTestId('char-counter').last()).toHaveClass(/over/);
  await a.getByRole('button', { name: 'Send comment' }).click();
  await expect(a.getByText('Comment must be 300 characters or fewer')).toBeVisible();
  await snap(a, info, '08a-comment-too-long');
  await a.getByLabel('Comment', { exact: true }).fill('');
  await a.getByRole('button', { name: 'Send comment' }).click();
  await expect(a.getByText('Comment text is required')).toBeVisible();
  const longComment = await call('POST', `/publications/${cat.publicationId}/comments`, userA.token, { text: 'x'.repeat(301), type: 'comment' });
  expect(longComment.status).toBe(400);
  const okComment = await call('POST', `/publications/${cat.publicationId}/comments`, userA.token, { text: 'x'.repeat(300), type: 'comment' });
  expect(okComment.status).toBe(201);

  // Photo > 2MB, vaccines > 200 and required fields on the pet form
  await a.goto('/pets/new');
  await a.getByRole('button', { name: 'Save pet' }).click();
  for (const msg of ['Name is required', 'Species is required', 'Sex is required', 'Size is required', 'Photo is required'])
    await expect(a.getByText(msg)).toBeVisible();
  await snap(a, info, '08b-pet-required-fields');
  await a.getByLabel('Photo', { exact: true }).setInputFiles(bigPng());
  await expect(a.getByText('Photo must be 2MB or smaller')).toBeVisible();
  await a.getByLabel('Vaccines (optional)').fill('v'.repeat(201));
  await a.getByRole('button', { name: 'Save pet' }).click();
  await expect(a.getByText('Vaccines must be 200 characters or fewer')).toBeVisible();
  await snap(a, info, '08c-photo-and-vaccines-too-big');

  const base = { name: 'Rex', species: 'dog', sex: 'male', size: 'large', photo: PNG_DATA_URL };
  expect((await call('POST', '/pets', userA.token, { ...base, photo: BIG_PNG_DATA_URL })).status).toBe(400);
  expect((await call('POST', '/pets', userA.token, { ...base, vaccines: 'v'.repeat(201) })).status).toBe(400);
  expect((await call('POST', '/pets', userA.token, { ...base, vaccines: 'v'.repeat(200) })).status).toBe(201);
  for (const field of ['name', 'species', 'sex', 'size', 'photo']) {
    const { [field]: _omit, ...rest } = base as Record<string, string>;
    void _omit;
    expect((await call('POST', '/pets', userA.token, rest)).status, `missing ${field}`).toBe(400);
  }
  expect((await call('POST', '/pets', userA.token, { ...base, species: 'bird' })).status).toBe(400);
  expect((await call('POST', `/publications/${cat.publicationId}/comments`, undefined, { text: 'hi', type: 'comment' })).status).toBe(400);
  expect(
    (await call('POST', `/publications/${cat.publicationId}/comments`, undefined, {
      text: 'hi', type: 'sighting', authorName: 'Anon', authorEmail: 'anon@example.com', photo: BIG_PNG_DATA_URL,
    })).status,
  ).toBe(400);

  // Required fields on registration and anonymous comment
  const anon = await actors.open('anonymous');
  await anon.goto('/register');
  await anon.getByRole('button', { name: 'Register' }).click();
  for (const msg of ['Name is required', 'A valid email is required', 'A valid phone is required', 'Commune is required'])
    await expect(anon.getByText(msg)).toBeVisible();
  await snap(anon, info, '08d-register-required');
  expect((await call('POST', '/auth/register', undefined, { alias: 'only_alias' })).status).toBe(400);
  await openPublication(anon, cat.publicationId);
  await anon.getByRole('button', { name: 'Send comment' }).click();
  for (const msg of ['Name is required', 'A valid email is required', 'Comment text is required'])
    await expect(anon.getByText(msg)).toBeVisible();
  await snap(anon, info, '08e-anonymous-comment-required');
});

test('9. Responsive: grid usable at 375px, tablet and desktop', async ({}, info) => {
  const viewports = [
    { name: 'mobile-375', width: 375, height: 812, cols: 1 },
    { name: 'tablet-768', width: 768, height: 1024, cols: 2 },
    { name: 'desktop-1280', width: 1280, height: 800, cols: 3 },
  ];
  for (const vp of viewports) {
    const page = await actors.open(`anon-${vp.name}`, undefined, { width: vp.width, height: vp.height });
    await page.goto('/');
    const grid = page.getByTestId('publication-grid');
    await expect(grid.getByTestId('publication-card').first()).toBeVisible();
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols, vp.name).toBe(vp.cols);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${vp.name} horizontal overflow`).toBeLessThanOrEqual(0);
    await expect(page.getByLabel('Filter by commune')).toBeVisible();
    await expect(page.getByLabel('Filter by species')).toBeVisible();
    await snap(page, info, `09-home-${vp.name}`);
    await page.getByTestId('publication-card').first().getByRole('link').first().click();
    await expect(page.getByLabel('Comment', { exact: true })).toBeVisible();
    const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(detailOverflow, `${vp.name} detail overflow`).toBeLessThanOrEqual(0);
    await snap(page, info, `09-detail-${vp.name}`);
  }
});
