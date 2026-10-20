import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makePet, makePublication, renderApp } from '../test/utils';

const png = (size = 10, type = 'image/png') => new File([new Uint8Array(size)], 'pet.png', { type });

describe('NewPetPage', () => {
  it('enforces required fields, vaccine length and photo limits', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderApp('/pets/new', {}, { token: 'tok' });
    const save = await screen.findByRole('button', { name: 'Save pet' });
    await user.click(save);
    for (const msg of ['Name is required', 'Species is required', 'Sex is required', 'Size is required', 'Photo is required'])
      expect(screen.getByText(msg)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Vaccines (optional)'), { target: { value: 'v'.repeat(201) } });
    expect(screen.getByText('201/200')).toHaveClass('over');
    await user.click(save);
    expect(screen.getByText('Vaccines must be 200 characters or fewer')).toBeInTheDocument();

    const photo = screen.getByLabelText('Photo');
    await user.upload(photo, png(2 * 1024 * 1024 + 1));
    expect(await screen.findByText('Photo must be 2MB or smaller')).toBeInTheDocument();
    await user.upload(photo, png(10, 'application/pdf'));
    expect(await screen.findByText(/file must be an image/i)).toBeInTheDocument();
    fireEvent.change(photo, { target: { files: [] } });
    await waitFor(() => expect(screen.queryByText(/file must be an image/i)).not.toBeInTheDocument());
  });

  it('creates a pet and returns to the pet list', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { calls } = renderApp(
      '/pets/new',
      {
        'POST /pets': () =>
          ++attempts === 1 ? { status: 400, body: { message: ['photo must be 2MB or smaller'] } } : { status: 201, body: makePet() },
        'GET /pets': { body: [makePet({ vaccines: 'Rabies 2025' })] },
      },
      { token: 'tok' },
    );
    await user.type(await screen.findByLabelText('Name'), 'Toby');
    await user.selectOptions(screen.getByLabelText('Species'), 'dog');
    await user.selectOptions(screen.getByLabelText('Sex'), 'male');
    await user.selectOptions(screen.getByLabelText('Size'), 'medium');
    await user.type(screen.getByLabelText('Color (optional)'), 'brown');
    await user.type(screen.getByLabelText('Vaccines (optional)'), 'Rabies 2025');
    await user.type(screen.getByLabelText('Description (optional)'), 'Friendly');
    await user.upload(screen.getByLabelText('Photo'), png());
    expect(await screen.findByAltText('Selected photo preview')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    expect(await screen.findByText('photo must be 2MB or smaller')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    expect(await screen.findByRole('heading', { name: 'My pets' })).toBeInTheDocument();
    expect(screen.getByText('Vaccines: Rabies 2025')).toBeInTheDocument();
    const body = calls.filter((c) => c.method === 'POST')[1].body!;
    expect(body).toMatchObject({ name: 'Toby', species: 'dog', sex: 'male', size: 'medium', color: 'brown', vaccines: 'Rabies 2025', description: 'Friendly' });
    expect(String(body.photo)).toMatch(/^data:image\/png;base64,/);
  });

  it('omits optional fields that were left empty', async () => {
    const user = userEvent.setup();
    const { calls } = renderApp('/pets/new', { 'POST /pets': { status: 201, body: makePet() }, 'GET /pets': { body: [] } }, { token: 'tok' });
    await user.type(await screen.findByLabelText('Name'), 'Toby');
    await user.selectOptions(screen.getByLabelText('Species'), 'cat');
    await user.selectOptions(screen.getByLabelText('Sex'), 'female');
    await user.selectOptions(screen.getByLabelText('Size'), 'small');
    await user.upload(screen.getByLabelText('Photo'), png());
    await screen.findByAltText('Selected photo preview');
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    await screen.findByText(/not added any pets/i);
    expect(Object.keys(calls.find((c) => c.method === 'POST')!.body!).sort()).toEqual(['name', 'photo', 'sex', 'size', 'species']);
  });
});

describe('MyPetsPage', () => {
  const routes = {
    'GET /pets': { body: [makePet({ vaccines: 'Rabies' })] },
    'GET /publications/pub9': { body: makePublication({ id: 'pub9', isOwner: true }) },
    'GET /publications/pub9/comments': { body: [] },
  };

  it('publishes a lost report and opens it', async () => {
    const user = userEvent.setup();
    const { calls } = renderApp(
      '/my-pets',
      { ...routes, 'POST /publications': { status: 201, body: makePublication({ id: 'pub9' }) } },
      { token: 'tok' },
    );
    await user.click(await screen.findByRole('button', { name: 'Report as lost' }));
    const form = screen.getByRole('form', { name: 'Report Toby as lost' });
    expect(within(form).getByLabelText('Commune where lost')).toHaveValue('Providencia');
    await user.type(within(form).getByLabelText('Last seen near (optional)'), 'Park');
    await user.type(within(form).getByLabelText('Details (optional)'), 'Red collar');
    await user.click(within(form).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByTestId('publication-status')).toHaveTextContent('Lost');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ petId: 'p1', commune: 'Providencia', lastSeenAddress: 'Park', description: 'Red collar' });
  });

  it('warns when the pet already has an active publication', async () => {
    const user = userEvent.setup();
    renderApp('/my-pets', { ...routes, 'POST /publications': { status: 409, body: { message: 'exists' } } }, { token: 'tok' });
    await user.click(await screen.findByRole('button', { name: 'Report as lost' }));
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByTestId('publish-warning')).toHaveTextContent(/already has an active publication/);
  });

  it('shows other errors, requires a commune and can be cancelled', async () => {
    const user = userEvent.setup();
    renderApp('/my-pets', { ...routes, 'POST /publications': { status: 500, body: { message: 'Server exploded' } } }, { token: 'tok' });
    await user.click(await screen.findByRole('button', { name: 'Report as lost' }));
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Commune where lost'), '');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText('Commune is required')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Report as lost' })).toBeInTheDocument();
  });

  it('shows list errors', async () => {
    renderApp('/my-pets', { 'GET /pets': { status: 500, body: { message: 'Cannot load pets' } } }, { token: 'tok' });
    expect(await screen.findByText('Cannot load pets')).toBeInTheDocument();
  });
});

describe('HistoryPage', () => {
  it('lists active and found publications', async () => {
    renderApp(
      '/history',
      { 'GET /publications/mine': { body: [makePublication(), makePublication({ id: 'pub2', status: 'found', pet: makePet({ name: 'Rex' }) })] } },
      { token: 'tok' },
    );
    const items = await screen.findAllByTestId('history-item');
    expect(items[0]).toHaveTextContent('Lost');
    expect(items[1]).toHaveTextContent('Found');
  });
  it('shows empty and error states', async () => {
    renderApp('/history', { 'GET /publications/mine': { body: [] } }, { token: 'tok' });
    expect(await screen.findByText(/no publications yet/i)).toBeInTheDocument();
  });
  it('shows errors', async () => {
    renderApp('/history', { 'GET /publications/mine': { status: 500, body: { message: 'History failed' } } }, { token: 'tok' });
    expect(await screen.findByText('History failed')).toBeInTheDocument();
  });
});

describe('NotificationsPage', () => {
  const notifications = [
    { id: 'n1', type: 'possible_finding', message: 'userC reported a possible finding', read: false, publicationId: 'pub1', commentId: 'c1', createdAt: '2026-10-20T12:00:00Z' },
    { id: 'n2', type: 'sighting', message: 'Rosa reported a sighting', read: true, publicationId: 'pub1', commentId: 'c2', createdAt: '2026-10-20T12:00:00Z' },
  ];

  it('opens a notification, marking it read', async () => {
    const user = userEvent.setup();
    const { calls } = renderApp(
      '/notifications',
      {
        'GET /notifications': { body: notifications },
        'PATCH /notifications/n1/read': { body: { ...notifications[0], read: true } },
        'GET /publications/pub1': { body: makePublication({ isOwner: true }) },
        'GET /publications/pub1/comments': { body: [] },
      },
      { token: 'tok' },
    );
    const items = await screen.findAllByTestId('notification');
    expect(items[0]).toHaveClass('unread');
    expect(items[1]).not.toHaveClass('unread');
    await user.click(screen.getByRole('button', { name: /possible finding/ }));
    expect(await screen.findByTestId('publication-status')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH' && c.path === '/notifications/n1/read')).toBe(true);
  });

  it('opens an already-read notification without marking it', async () => {
    const user = userEvent.setup();
    const { calls } = renderApp(
      '/notifications',
      {
        'GET /notifications': { body: notifications },
        'GET /publications/pub1': { body: makePublication() },
        'GET /publications/pub1/comments': { body: [] },
      },
      { token: 'tok' },
    );
    await user.click(await screen.findByRole('button', { name: /sighting/ }));
    await screen.findByTestId('publication-status');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('marks all as read and reports errors', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    renderApp(
      '/notifications',
      {
        'GET /notifications': { body: notifications },
        'PATCH /notifications/read-all': () => (++attempts === 1 ? { status: 500, body: { message: 'Nope' } } : { body: { updated: 1 } }),
      },
      { token: 'tok' },
    );
    await screen.findAllByTestId('notification');
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(await screen.findByText('Nope')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => screen.getAllByTestId('notification').forEach((n) => expect(n).not.toHaveClass('unread')));
  });

  it('shows empty and error states', async () => {
    renderApp('/notifications', { 'GET /notifications': { body: [] } }, { token: 'tok' });
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });

  it('shows load errors', async () => {
    renderApp('/notifications', { 'GET /notifications': { status: 500, body: { message: 'Load failed' } } }, { token: 'tok' });
    expect(await screen.findByText('Load failed')).toBeInTheDocument();
  });
});
