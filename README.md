# KunguBook · mobile app

[![CI](https://github.com/wakaflorien/kungubook-app/actions/workflows/ci.yml/badge.svg)](https://github.com/wakaflorien/kungubook-app/actions/workflows/ci.yml)

KunguBook is a personal finance app for Rwanda (RWF by default, other currencies allowed). This repo is the app for iPhone and Android, built with Expo SDK 58, Expo Router and strict TypeScript.

The app talks to the standalone KunguBook API, which lives in its own repo. Until that API exists, the app runs against a **Prism mock** of the contract.

```
my-finance/                  parent folder (not a repo)
├─ docs/                     PRD, TRD, app flow, design system, openapi.yaml (shared by every repo)
├─ design/                   tokens.json, kit.css, screens, sample-data.md (shared)
├─ kungubook-app/            ← this repo
└─ (later) kungubook-api/, kungubook-web/
```

## Status

| Milestone                       | State                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0 · Foundations**            | Done. Tab shell and + sheet, UI kit, theme, API client, mocks and CI are in. Home shows the accounts total from the mock. Checked on the iOS simulator. |
| M1 · Auth, onboarding, accounts | Next                                                                                                                                                    |
| M2–M8                           | See `../docs/06-implementation-plan.md`                                                                                                                 |

## Prerequisites

- Node 22+ and pnpm 9 (`corepack enable`).
- For iOS: Xcode with an iOS simulator. The first `pnpm ios` downloads Expo Go for SDK 58 (about 156 MB) and installs it on the simulator.
- For Android: Android Studio with an emulator.

## Quick start

```bash
pnpm install
pnpm mock          # terminal 1: Prism on http://localhost:4010, serving src/api/openapi.yaml
pnpm ios           # terminal 2: or `pnpm start`, then press i / a
```

Home shows **RWF 3,480,000**, the accounts total that `GET /accounts` returns for the demo user Keza Uwase. If the mock isn't running, Home shows "Couldn't load your balances" with a _Try again_ button.

## Scripts

| Script                             | What it does                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm start` / `ios` / `android`   | Expo dev server                                                                                                                                  |
| `pnpm mock`                        | Prism mock server on port 4010                                                                                                                   |
| `pnpm lint` · `typecheck` · `test` | ESLint, `tsc --noEmit`, Vitest                                                                                                                   |
| `pnpm format` / `format:check`     | Prettier                                                                                                                                         |
| `pnpm api:sync`                    | Copies the spec (`SPEC_PATH`, default `../docs/openapi.yaml`, or `API_SPEC_URL`) to `src/api/openapi.yaml` and regenerates `src/api/schema.d.ts` |
| `pnpm api:sync --check`            | Fails if `schema.d.ts` is out of date (CI)                                                                                                       |
| `pnpm tokens`                      | `../design/tokens.json` (or `TOKENS_PATH`) → `src/theme/tokens.ts`                                                                               |
| `pnpm doctor`                      | `expo-doctor`: checks dependency versions against the SDK                                                                                        |

The generated files (`src/api/openapi.yaml`, `src/api/schema.d.ts` and `src/theme/tokens.ts`) are committed, so this repo builds without the parent folder. Re-run `pnpm api:sync` or `pnpm tokens` after changing `../docs/openapi.yaml` or `../design/tokens.json`, then commit the result.

## Environments

`APP_ENV` picks which API the app talks to (see `app.config.ts`). The EAS build profiles set it.

| APP_ENV          | API                                                    | EAS profile |
| ---------------- | ------------------------------------------------------ | ----------- |
| `mock` (default) | `http://localhost:4010` (Android emulator: `10.0.2.2`) | development |
| `staging`        | `https://staging-api.kungubook.app/v1`                 | preview     |
| `production`     | `https://api.kungubook.app/v1`                         | production  |

`EXPO_PUBLIC_API_URL` overrides the URL. For example, set it to your Mac's LAN IP so a physical phone can reach `pnpm mock`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4010 pnpm start
```

## Layout

```
src/app/            routes: (tabs)/index · activity · money · insights, add (+ sheet)
src/ui/             design-system components (colours only via useTheme(); hex literals fail lint)
src/theme/          generated tokens + ThemeProvider/useTheme()
src/lib/money/      formatMoney, parseMoney, amortize (pure TS, unit-tested)
src/api/            spec copy, generated types, openapi-fetch wrapper (auth, refresh, X-App-Version, errors, 426)
src/config/         env (APP_ENV → base URL) and the app's API client instance
src/features/       feature hooks (accounts …)
mocks/              seed (Keza Uwase) + stateful MSW handlers for tests
scripts/            api-sync, tokens
```

`src/lib`, `src/theme/tokens.ts` and `src/api` import nothing from React Native, so they can move into a shared package when the web repo starts.

## Rules

- **Money** is stored as integer minor units, and RWF has no decimals. Amounts are shown only through `<Amount>`, which calls `formatMoney()`.
- **IDs** are UUID v7, generated on the client (`newId()` in `src/lib/id.ts`).
- **UI:**
  - text is at least 12px and touch targets at least 44px;
  - the tab bar and its active capsule are fully rounded;
  - components take their colours from `useTheme()`, never from hex literals.
- **API:** screens never call `fetch` directly. Go through `src/api` (`unwrap(api.GET(...))` with TanStack Query).
- **Sample data** is always the fictional Keza Uwase (`keza@example.com`). Never use real names or emails.
- **Commits and PRs** contain no AI tags or attribution lines.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

- **checks:** `format:check`, `lint`, `typecheck`, `test`.
- **contract:**
  - `api:sync --check` confirms the generated client matches the committed spec.
  - `oasdiff breaking` compares the committed spec with the API's live spec. This step is skipped until the repository variable `API_SPEC_URL` is set.

## Manual steps

- **EAS:** the project is linked: [@wakaflorien/kungubook](https://expo.dev/accounts/wakaflorien/projects/kungubook), with `owner` and `extra.eas.projectId` set in `app.config.ts`. Because the config is dynamic (`app.config.ts`), `eas init` can't write the ID itself; it lives in the `EAS_PROJECT_ID` constant. To build, run `eas build --profile development` (iOS simulator build against the mock).
- **CI contract check:** once the backend publishes its spec, set the repository variable `API_SPEC_URL`.

## Troubleshooting

- **"Couldn't load your balances"**: the mock isn't running, or the phone can't reach it. Start it with `pnpm mock`. On a physical phone, also set `EXPO_PUBLIC_API_URL` (see Environments).
- **Android emulator can't reach the mock**: the app already rewrites `localhost` to `10.0.2.2` on Android. Check that port 4010 is free.
- **Generated types look stale**: run `pnpm api:sync`, then `pnpm typecheck`.
