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

| Milestone                           | State                                                                                                                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0 · Foundations**                | Done. Tab shell and + sheet, UI kit, theme, API client, mocks and CI are in. Home shows the accounts total from the mock. Checked on the iOS simulator.                                                                                                             |
| **M1 · Auth, onboarding, accounts** | Done against the mock. Sign-up/in (email, Apple, Google code paths), password reset, onboarding steps 2–6, PIN + biometrics, auto-lock, encrypted cache, device registration, accounts list/detail/add/edit. Checked on the iOS simulator and the Android emulator. |
| M2 · Transactions & sync            | Next                                                                                                                                                                                                                                                                |
| M2–M8                               | See `../docs/06-implementation-plan.md`                                                                                                                                                                                                                             |

## Prerequisites

- Node 22+ and pnpm 9 (`corepack enable`).
- For iOS: Xcode with an iOS simulator. The first `pnpm ios` downloads Expo Go for SDK 58 (about 156 MB) and installs it on the simulator.
- For Android: Android Studio with an emulator.

## Quick start

```bash
pnpm install
pnpm mock          # terminal 1: mock API on http://localhost:4010
pnpm ios           # terminal 2: or `pnpm start`, then press i / a
```

The app opens on Welcome. **Create account** runs the full onboarding (6 steps); **I already have an account** signs in.
The seeded demo user is `keza@example.com` / `kungubook-demo` (fictional, mock only); Home then shows **RWF 3,480,000** from `GET /accounts`.

### The mock API

`pnpm mock` runs two layers (scripts/mock-server.ts):

| Port | What answers                                                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4010 | **Stateful** MSW handlers from `mocks/handlers.ts`: auth (sign-up, sign-in, Apple/Google, refresh with rotation, logout, password reset, verify password), `/me`, `/me/settings`, `/me/devices`, accounts and transactions. New users, accounts and edits are remembered until the server stops. |
| 4011 | Prism on `src/api/openapi.yaml` for every other route (loans, net worth, …), returning the spec's examples.                                                                                                                                                                                      |

Mock-only test values: the password-reset link token is `mock-reset-token` (open `kungubook://reset-password?token=mock-reset-token`); Apple and Google tokens are accepted as-is. `pnpm mock:prism` runs plain Prism on 4010 instead.

### Insomnia collection

Run `pnpm api:insomnia` to write `api-collections/insomnia.json`: every route in the spec (111 requests, one folder per tag). The file stays on your machine (git ignores it). In Insomnia, choose **Import** and pick the file, then select an environment:

- **Mock (localhost)**: `http://localhost:4010`.
- **Mock (Android emulator)**: `http://10.0.2.2:4010`.
- **Staging (not live yet)**: a placeholder for the real API.

Start `pnpm mock`, then send any request. You don't need to sign in first: `access_token` runs **Auth → Sign in** with the demo user (`keza@example.com` / `kungubook-demo`, set in the base environment) and runs it again once the token is 14 minutes old. Path IDs (`account_id`, `transaction_id`, …) are environment variables; the defaults point at Keza's seed data. Query parameters are listed but turned off.

The collection is generated from `src/api/openapi.yaml`; don't edit the file by hand. When the backend publishes its spec, run `pnpm api:sync` and then `pnpm api:insomnia`, and re-import the file: it replaces this collection. Edits you make inside Insomnia are lost when you re-import.

## Security model (M1)

- **Tokens** live in the Keychain / Keystore (`expo-secure-store`, this device only). Every request carries the bearer token; on `401 token_expired` the client refreshes once (refresh tokens rotate) and retries; if the refresh is refused the app signs out and wipes local data.
- **PIN**: 4 digits, stored only as a salted, iterated SHA-256 hash (native digest, ~0.6–0.8 s to set or check in debug builds) in secure storage. 5 wrong PINs → 30 s wait; 10 → the account password is required (Forgot PIN). Biometrics (Face ID / fingerprint) can unlock instead.
- **Auto-lock** after 1 minute in the background and on every cold start; the app-switcher snapshot is covered.
- **Local cache**: SQLite encrypted with SQLCipher, key in secure storage. Signing out deletes the database, its key, the PIN and the tokens.

## Scripts

| Script                             | What it does                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm start` / `ios` / `android`   | Expo dev server                                                                                                                                  |
| `pnpm mock`                        | Mock API on port 4010 (stateful handlers, Prism for the rest)                                                                                    |
| `pnpm lint` · `typecheck` · `test` | ESLint, `tsc --noEmit`, Vitest                                                                                                                   |
| `pnpm format` / `format:check`     | Prettier                                                                                                                                         |
| `pnpm api:sync`                    | Copies the spec (`SPEC_PATH`, default `../docs/openapi.yaml`, or `API_SPEC_URL`) to `src/api/openapi.yaml` and regenerates `src/api/schema.d.ts` |
| `pnpm api:sync --check`            | Fails if `schema.d.ts` is out of date (CI)                                                                                                       |
| `pnpm api:insomnia`                | Builds a local Insomnia collection, `api-collections/insomnia.json`, from the spec (not committed)                                               |
| `pnpm tokens`                      | `../design/tokens.json` (or `TOKENS_PATH`) → `src/theme/tokens.ts`                                                                               |
| `pnpm doctor`                      | `expo-doctor`: checks dependency versions against the SDK                                                                                        |

The generated files (`src/api/openapi.yaml`, `src/api/schema.d.ts` and `src/theme/tokens.ts`) are committed, so this repo builds without the parent folder. Re-run `pnpm api:sync` (then `pnpm api:insomnia`) or `pnpm tokens` after changing `../docs/openapi.yaml` or `../design/tokens.json`, then commit the result.

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
src/app/            routes (native tabs + native stack headers; see docs/04 §4.1): (auth) welcome·sign-in·sign-up·forgot/reset password · (onboarding) setup/* ·
                    (locked) lock·forgot-pin·new-pin · (app) tabs, + sheet, accounts/*
src/ui/             design-system components (colours only via useTheme(); hex literals fail lint);
                    Switch/Segmented/Select/Slider/ProgressBar have .ios/.android files using native
                    SwiftUI / Jetpack Compose controls (@expo/ui); nativeHeader.tsx = header options + toolbar
src/theme/          generated tokens + ThemeProvider/useTheme()
src/lib/            pure TS, unit-tested: money, auth (service, token store), security (PIN lock, auto-lock), id
src/api/            spec copy, generated types, openapi-fetch wrapper (auth, refresh, X-App-Version, errors, 426)
src/platform/       native adapters: secure store, biometrics, encrypted SQLite cache, push, Apple/Google sign-in
src/state/          session state machine (signedOut → onboarding → locked ⇄ ready)
src/config/         env (APP_ENV → base URL) and the app's services (API client, auth, PIN lock, cache)
src/features/       screens' building blocks and hooks: accounts, auth, me, security
mocks/              seed (Keza Uwase) + stateful MSW handlers (tests and `pnpm mock`)
scripts/            api-sync, insomnia, tokens, mock-server
api-collections/    local Insomnia collection from pnpm api:insomnia (git-ignored)
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

These need your accounts or a real device, so they weren't done here:

- **Development build** (needed for SQLCipher, Google sign-in, push and Face ID prompts in your own app identity): `eas build --profile development --platform ios` (simulator) or `--platform android`, then `pnpm start` and open it. Expo Go works for everything else.
- **Sign in with Apple**: enable the _Sign in with Apple_ capability for `app.kungubook.mobile` in your Apple Developer account (EAS can do it on the first build). In Expo Go it signs in with Expo Go's identity, so the API must accept that audience only in development.
- **Sign in with Google**: create OAuth client IDs in Google Cloud (iOS + Web; Android uses the SHA-1 of the signing key), then set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME` (the reversed iOS client ID) as EAS environment variables. Until then the Google button says it isn't set up.
- **Push notifications**: on a physical phone with a dev build, accept the permission on step 4; the app registers its Expo push token with `POST /me/devices`. Simulators and Expo Go on Android register the device without a token.
- **Device test**: run the M1 done-check on a real iPhone and Android phone (sign up, add 3 accounts, set a PIN, kill the app, unlock) and time the unlock (see Known issues).

- **EAS:** the project is linked: [@wakaflorien/kungubook](https://expo.dev/accounts/wakaflorien/projects/kungubook), with `owner` and `extra.eas.projectId` set in `app.config.ts`. Because the config is dynamic (`app.config.ts`), `eas init` can't write the ID itself; it lives in the `EAS_PROJECT_ID` constant. To build, run `eas build --profile development` (iOS simulator build against the mock).
- **CI contract check:** once the backend publishes its spec, set the repository variable `API_SPEC_URL`.

## Known issues

- **Expo Go shows the full native look** on the iOS 27 simulator, including the Liquid Glass tab bar with + as a separate prominent item. Older iOS versions show a standard tab bar with + as the 5th tab.
- **Dev-only navigation notice** (`ROUTE_NAMES_CHANGED … not handled`) can appear when a protected group mounts after sign-in or unlock. Each group routes itself once mounted; the notice doesn't exist in production builds.

## Troubleshooting

- **"Couldn't load your balances"**: the mock isn't running, or the phone can't reach it. Start it with `pnpm mock`. On a physical phone, also set `EXPO_PUBLIC_API_URL` (see Environments).
- **Android emulator can't reach the mock**: the app already rewrites `localhost` to `10.0.2.2` on Android. Check that port 4010 is free.
- **Generated types look stale**: run `pnpm api:sync`, then `pnpm typecheck`.
