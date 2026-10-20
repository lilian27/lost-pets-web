import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PNG, makeComment, makePet, makePublication, owner, renderApp } from '../test/utils';

const detail = (pub = makePublication(), comments = [makeComment()]) => ({
  'GET /publications/pub1': { body: pub },
  'GET /publications/pub1/comments': { body: comments },
});

describe('PublicationPage', () => {
  it('shows the full detail with alias only and lets the owner mark it found', async () => {
    const user = userEvent.setup();
    const pub = makePublication({
      isOwner: true,
      description: 'Very friendly',
      lastSeenAddress: 'Parque Bustamante',
      pet: makePet({ color: 'brown', vaccines: 'Rabies' }),
    });
    let attempts = 0;
    renderApp(
      '/publications/pub1',
      {
        ...detail(pub),
        'PATCH /publications/pub1/status': () =>
          ++attempts === 1
            ? { status: 500, body: { message: 'Status failed' } }
            : { body: { ...pub, status: 'found', foundAt: '2026-10-21T10:00:00Z' } },
      },
      { token: 'tok' },
    );
    expect(await screen.findByRole('heading', { name: 'Toby' })).toBeInTheDocument();
    for (const text of ['brown', 'Rabies', 'Parque Bustamante', 'Very friendly']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByTestId('owner-alias')).toHaveTextContent('ownerA');
    const main = screen.getByRole('article');
    for (const secret of [owner.email, owner.phone, owner.name]) expect(main.textContent).not.toContain(secret);

    await user.click(screen.getByRole('button', { name: 'Mark as found' }));
    expect(await screen.findByText('Status failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark as found' }));
    expect(await screen.findByText('Found', { selector: '[data-testid="publication-status"]' })).toBeInTheDocument();
    expect(screen.getByText('Found on')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as found' })).not.toBeInTheDocument();
    expect(screen.getByText(/publication is closed/i)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Add a comment' })).not.toBeInTheDocument();
  });

  it('hides the status button from non-owners', async () => {
    renderApp('/publications/pub1', detail(), { token: 'tok' });
    await screen.findByRole('heading', { name: 'Toby' });
    expect(screen.queryByRole('button', { name: 'Mark as found' })).not.toBeInTheDocument();
  });

  it('reports missing and failing publications', async () => {
    renderApp('/publications/pub1', { 'GET /publications/pub1': { status: 404, body: { message: 'x' } }, 'GET /publications/pub1/comments': { status: 404 } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Publication not found');
  });

  it('reports other load errors', async () => {
    renderApp('/publications/pub1', { 'GET /publications/pub1': { status: 500, body: { message: 'Kaboom' } }, 'GET /publications/pub1/comments': { body: [] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Kaboom');
  });

  it('lets anonymous visitors post a sighting with photo and edit it with the stored token', async () => {
    const user = userEvent.setup();
    const created = makeComment({ id: 'c9', type: 'sighting', isAnonymous: true, author: null, authorName: 'Rosa', text: 'Saw it', photo: PNG, editToken: 'tok-9' });
    const { calls } = renderApp('/publications/pub1', {
      ...detail(makePublication(), []),
      'POST /publications/pub1/comments': { status: 201, body: created },
      'PATCH /comments/c9': (c) => ({ body: { ...created, editToken: undefined, text: c.body?.text, edited: true } }),
    });
    const form = await screen.findByRole('form', { name: 'Add a comment' });
    await user.click(within(form).getByRole('button', { name: 'Send comment' }));
    for (const msg of ['Name is required', 'A valid email is required', 'Comment text is required']) expect(screen.getByText(msg)).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText('Comment'), { target: { value: 'x'.repeat(301) } });
    await user.click(within(form).getByRole('button', { name: 'Send comment' }));
    expect(screen.getByText('Comment must be 300 characters or fewer')).toBeInTheDocument();

    await user.type(within(form).getByLabelText('Your name'), 'Rosa');
    await user.type(within(form).getByLabelText('Your email (never shown)'), 'rosa@example.com');
    await user.selectOptions(within(form).getByLabelText('Type'), 'sighting');
    fireEvent.change(within(form).getByLabelText('Comment'), { target: { value: 'Saw it' } });
    await user.upload(within(form).getByLabelText('Photo (optional)'), new File(['x'], 's.png', { type: 'image/png' }));
    await within(form).findByAltText('Selected photo preview');
    await user.click(within(form).getByRole('button', { name: 'Send comment' }));

    const item = await screen.findByTestId('comment');
    expect(item).toHaveTextContent('(guest)');
    expect(within(item).getByAltText('Photo from Rosa')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ authorName: 'Rosa', authorEmail: 'rosa@example.com', type: 'sighting', text: 'Saw it' });
    expect(JSON.parse(localStorage.getItem('lp.editTokens')!)).toEqual({ c9: 'tok-9' });
    expect(within(form).getByLabelText('Comment')).toHaveValue('');

    await user.click(within(item).getByRole('button', { name: 'Edit' }));
    await user.clear(within(item).getByLabelText('Edit comment'));
    await user.type(within(item).getByLabelText('Edit comment'), 'Saw it at 9am');
    await user.click(within(item).getByRole('button', { name: 'Save' }));
    expect(await within(item).findByText('Saw it at 9am')).toBeInTheDocument();
    expect(item).toHaveTextContent('(edited)');
    expect(calls.find((c) => c.method === 'PATCH')?.headers['X-Edit-Token']).toBe('tok-9');
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('lets registered users post a possible finding and shows the flag icon', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { calls } = renderApp(
      '/publications/pub1',
      {
        ...detail(makePublication(), []),
        'POST /publications/pub1/comments': (c) =>
          ++attempts === 1
            ? { status: 400, body: { message: ['text must be shorter'] } }
            : { status: 201, body: makeComment({ id: 'c5', type: 'possible_finding', text: String(c.body?.text) }) },
      },
      { token: 'tok' },
    );
    const form = await screen.findByRole('form', { name: 'Add a comment' });
    expect(within(form).queryByLabelText('Your name')).not.toBeInTheDocument();
    await user.selectOptions(within(form).getByLabelText('Type'), 'possible_finding');
    await user.type(within(form).getByLabelText('Comment'), 'In my yard');
    await user.click(within(form).getByRole('button', { name: 'Send comment' }));
    expect(await screen.findByText('text must be shorter')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Send comment' }));
    expect(await screen.findByTestId('possible-finding-flag')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')[1].body).toEqual({ text: 'In my yard', type: 'possible_finding' });
  });

  it('validates comment edits, supports cancel and shows edit errors', async () => {
    const user = userEvent.setup();
    renderApp('/publications/pub1', { ...detail(makePublication(), [makeComment({ canEdit: true })]), 'PATCH /comments/c1': { status: 403, body: { message: 'Forbidden' } } }, { token: 'tok' });
    const item = await screen.findByTestId('comment');
    await user.click(within(item).getByRole('button', { name: 'Edit' }));
    const box = within(item).getByLabelText('Edit comment');
    await user.clear(box);
    await user.click(within(item).getByRole('button', { name: 'Save' }));
    expect(within(item).getByText('Comment text is required')).toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'y'.repeat(301) } });
    await user.click(within(item).getByRole('button', { name: 'Save' }));
    expect(within(item).getByText('Comment must be 300 characters or fewer')).toBeInTheDocument();
    await user.click(within(item).getByRole('button', { name: 'Cancel' }));
    expect(within(item).getByText('Hello there')).toBeInTheDocument();
    await user.click(within(item).getByRole('button', { name: 'Edit' }));
    await user.type(within(item).getByLabelText('Edit comment'), '!');
    await user.click(within(item).getByRole('button', { name: 'Save' }));
    expect(await within(item).findByText('Forbidden')).toBeInTheDocument();
  });

  it('does not offer edit to other users and flags comments as offensive', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    renderApp(
      '/publications/pub1',
      {
        ...detail(makePublication(), [makeComment(), makeComment({ id: 'c2', text: 'Already reported', flaggedByMe: true, flagged: true, flagCount: 2 })]),
        'POST /comments/c1/flag': () =>
          ++attempts === 1 ? { status: 500, body: { message: 'Flag failed' } } : { status: 201, body: makeComment({ flagged: true, flagCount: 1, flaggedByMe: true }) },
      },
      { token: 'tok' },
    );
    const [first, second] = await screen.findAllByTestId('comment');
    expect(within(first).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(second).getByText('Reported')).toBeInTheDocument();
    expect(within(second).getByTestId('offensive-flag')).toHaveTextContent('Flagged as offensive (2)');
    await user.click(within(first).getByRole('button', { name: 'Report offensive' }));
    expect(await within(first).findByText('Flag failed')).toBeInTheDocument();
    await user.click(within(first).getByRole('button', { name: 'Report offensive' }));
    await waitFor(() => expect(within(first).getByTestId('offensive-flag')).toHaveTextContent('Flagged as offensive (1)'));
    expect(within(first).getByText('Reported')).toBeInTheDocument();
  });
});
