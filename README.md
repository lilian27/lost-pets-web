# lost-pets-web

Vite + React + TypeScript client for [lost-pets-api](https://github.com/lilian27/lost-pets-api).

## Run locally

```bash
# 1. API + MongoDB (in the lost-pets-api checkout)
docker compose up -d
npm install && npm run start:dev          # http://localhost:3000, Swagger at /docs

# 2. Web (this repo)
npm install
VITE_API_URL=http://localhost:3000 npm run dev   # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (`VITE_API_URL` points at the API, default `http://localhost:3000`) |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm run test` / `npm run test:cov` | Vitest unit/component tests (coverage threshold 90%) |
| `npm run e2e` | Playwright acceptance suite against the running API (see [INTEGRATION.md](INTEGRATION.md)) |

## Pages

- `/` – active publications grid (3/2/1 columns on desktop/tablet/mobile) with commune and species filters
- `/register`, `/login`
- `/my-pets`, `/pets/new` – manage pets and report one as lost (date/time set by the server)
- `/publications/:id` – detail, comment thread (comment / sighting / possible finding), edit, flag offensive; owner-only "Mark as found"
- `/history` – the owner's publications, including found ones
- `/notifications` – comments on your publications; unread badge in the navbar

Only the owner's alias is shown publicly; the API never returns real name, email or phone to other users.
