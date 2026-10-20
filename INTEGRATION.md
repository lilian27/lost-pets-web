# Integration verification: lost-pets-api × lost-pets-web

**Result: all 9 acceptance criteria PASS** (Playwright, Chromium, 9/9 tests, ~22s), run 2026-10-20 against a live NestJS API + MongoDB 7.

| Component | Revision under test |
| --- | --- |
| API | [lilian27/lost-pets-api#1](https://github.com/lilian27/lost-pets-api/pull/1) (`devin/1792465991-initial-api`) |
| Web | this PR |

Both repos only had a README at the start, so both apps were built for this verification. The API and web were written to the same contract. No backend gaps or contract mismatches came up during the e2e run, so there are no separate API fix PRs.

## How to reproduce

```bash
# lost-pets-api
docker compose up -d                                         # MongoDB 7 on :27017
docker exec lost-pets-mongo mongosh --quiet lost-pets-e2e --eval 'db.dropDatabase()'   # optional clean slate
MONGODB_URI=mongodb://localhost:27017/lost-pets-e2e npm run start:dev                  # :3000

# lost-pets-web
npm install && npx playwright install --with-deps chromium
npm run e2e        # starts `vite --port 5173` with VITE_API_URL=http://localhost:3000 unless WEB_URL is set
npx playwright show-report                                    # HTML report with screenshots, video and trace per test
```

Env overrides: `API_URL` (default `http://localhost:3000`), `WEB_URL` (if set, the suite uses that server instead of starting Vite).

The suite is `e2e/acceptance.spec.ts`. It runs serially, and each test is one acceptance step. Every test records:
- a Playwright **trace**, covering every browser context used by that step;
- a **video** for each actor (User A, User C, User B, anonymous);
- full-page **screenshots**, also committed to `docs/evidence/`.

Each run uses fresh users and pets with unique aliases and names, so re-running against the same database is safe.

## Acceptance checklist

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | User A registers (alias, name, email, phone, commune) → adds pet (dog, male, medium, PNG photo, 55-char vaccines) → publishes lost report. The server sets `lostAt`, and the test checks it is within ±5s of the click. | **PASS** | [register](docs/evidence/01a-register-form.png) · [pet form](docs/evidence/01b-add-pet-form.png) · [publication](docs/evidence/01c-publication-created.png) |
| 2 | Second report for the same pet → UI warning *"This pet already has an active publication…"*. API returns `409`, and the owner still has only 1 publication. | **PASS** | [warning](docs/evidence/02-duplicate-blocked.png) |
| 3 | Anonymous home: computed grid is **3 columns** at 1280px. Commune filter (Providencia vs Maipú) and species filter (dog vs cat) work. Only the alias is shown. The owner's email, phone and real name never appear in the rendered DOM, in any API response the browser received, or in direct `GET /publications`, `/publications/:id` and `/comments` calls. | **PASS** | [grid](docs/evidence/03a-home-grid.png) · [commune](docs/evidence/03b-filter-commune.png) · [species](docs/evidence/03c-filter-species-cat.png) · [detail](docs/evidence/03d-detail-alias-only.png) |
| 4 | Anonymous visitor (name + email) posts a `sighting` with a photo; the email is not shown. Registered User C posts a `possible_finding`, which shows the 🚩 flag icon. User A's navbar badge shows **2**, and `/notifications` lists both. | **PASS** | [sighting](docs/evidence/04a-anonymous-sighting.png) · [flag icon](docs/evidence/04b-possible-finding-flag.png) · [badge](docs/evidence/04c-owner-badge.png) · [notifications](docs/evidence/04d-owner-notifications.png) |
| 5 | User C and anonymous visitors see no "Mark as found" button. `PATCH /publications/:id/status` returns **403** for User C and **401** without a token, and the status stays `active`. | **PASS** | [no button](docs/evidence/05a-non-owner-no-button.png) |
| 6 | User A marks the publication found. After that:<ul><li>it is gone from home for anonymous visitors and User C;</li><li>its detail page returns "Publication not found" for both;</li><li>it appears as *Found* in User A's `/history`, with the full 2-comment thread.</li></ul> | **PASS** | [found](docs/evidence/06a-marked-found.png) · [home](docs/evidence/06b-home-without-found.png) · [history](docs/evidence/06c-owner-history.png) · [thread](docs/evidence/06d-owner-full-thread.png) |
| 7 | Edit works for registered authors and for anonymous authors (using the edit token kept in the browser), and the comment is marked *(edited)*. Other users get no Edit button, and the API returns `403` if they try. No Delete button exists anywhere, and `DELETE /comments/:id` returns `405` for both author and owner. "Report offensive" shows *Flagged as offensive (1)* and `flagCount` is 1. | **PASS** | [registered edit](docs/evidence/07a-registered-edit.png) · [anonymous edit](docs/evidence/07b-anonymous-edit.png) · [flag](docs/evidence/07c-flag-offensive.png) |
| 8 | Each limit is checked in both the UI and the API:<ul><li>comment of 301 chars is rejected (API `400`), 300 is accepted;</li><li>photo of 2MB+1 byte is rejected for both pets and comments (API `400`);</li><li>vaccines of 201 chars are rejected (API `400`), 200 is accepted;</li><li>required fields are enforced on the pet, registration and anonymous-comment forms and in the API (each pet field missing → `400`, invalid species → `400`).</li></ul> | **PASS** | [comment](docs/evidence/08a-comment-too-long.png) · [pet required](docs/evidence/08b-pet-required-fields.png) · [photo/vaccines](docs/evidence/08c-photo-and-vaccines-too-big.png) · [register](docs/evidence/08d-register-required.png) · [comment required](docs/evidence/08e-anonymous-comment-required.png) |
| 9 | The grid has 1 column at 375px, 2 columns at 768px and 3 columns at 1280px. No viewport overflows horizontally, on either the home page or the detail page, and the filters and comment form stay visible. | **PASS** | [375](docs/evidence/09-home-mobile-375.png) · [768](docs/evidence/09-home-tablet-768.png) · [1280](docs/evidence/09-home-desktop-1280.png) · [detail 375](docs/evidence/09-detail-mobile-375.png) |

The videos and traces are too large to commit (~50MB per run). They are produced in `test-results/` and `playwright-report/` on every `npm run e2e`. The zipped artifacts from this run are attached to the PR conversation.

## Coverage

| Repo | Command | Statements | Branches | Functions | Lines | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| lost-pets-api | `npm run test:cov` (Jest + Supertest + mongodb-memory-server) | **100%** (617/617) | **99.13%** (114/115) | **100%** (98/98) | **100%** (538/538) | 26 passed |
| lost-pets-web | `npm run test:cov` (Vitest + Testing Library, fetch mocked at the network boundary) | **100%** (1134/1134) | **98.83%** (339/343) | **100%** (99/99) | **100%** (1134/1134) | 48 passed |

Both repos fail CI if any of these metrics drops below 90%.

## Contract used

The contract follows the brief. Source of truth: Swagger at `GET /docs` (JSON at `/docs-json`) on the API.

**Auth**
- `POST /auth/register` and `POST /auth/login` return `{ accessToken, user }`.
- Authenticated requests use the header `Authorization: Bearer <token>`.

**Enums**
- `species`: `dog|cat`
- `sex`: `male|female`
- `size`: `small|medium|large`
- publication `status`: `active|found`
- comment `type`: `comment|sighting|possible_finding`

**Photos**
- Sent as base64 data URLs (`data:image/(png|jpeg|gif|webp);base64,...`).
- Limited to ≤2MB *decoded*. The API body limit is 5MB to leave room for the base64 overhead.

**Privacy**
- Public payloads include `owner: { id, alias }` only.
- Anonymous commenter emails are stored but never returned.

**Decisions taken where the brief was silent**
- **Anonymous comment editing.** `POST /publications/:id/comments` returns a one-time `editToken` to anonymous authors. The API stores only its SHA-256 hash. The web keeps the token in `localStorage` and sends it as `X-Edit-Token`.
- **Found publications.** Once found, a publication is visible only to its owner: through `/publications/mine` and through its detail and comments endpoints. Everyone else gets `404`. Found publications no longer accept new comments.
- **Notifications.** A notification is created when someone other than the owner comments. The web polls `GET /notifications/unread-count` every 5s for the badge.
- **Flagging.** Anyone can flag a comment as offensive. For registered users the flag counts once per user (idempotent).
