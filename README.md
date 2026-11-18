# KunguBook · mobile app

The KunguBook app for iPhone and Android (Expo SDK 58, Expo Router, TypeScript strict).
It talks to the standalone KunguBook API, which lives in its own repo. Until the API exists, the app runs against a **Prism mock** of the contract.

```
my-finance/                  parent folder (not a repo)
├─ docs/                     PRD, TRD, app flow, design system, openapi.yaml (shared by every repo)
├─ design/                   tokens.json, kit.css, screens, sample-data.md (shared)
├─ kungubook-app/            ← this repo
└─ (later) kungubook-api/, kungubook-web/
```

## Quick start

```bash
pnpm install
pnpm mock          # Prism on http://localhost:4010, serving src/api/openapi.yaml
pnpm ios           # or: pnpm start, then press i / a
```

Home shows the accounts total from `GET /accounts` (RWF 3,480,000 for the demo user Keza Uwase).

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

The generated files (`src/api/openapi.yaml`, `src/api/schema.d.ts`, `src/theme/tokens.ts`) are committed, so this repo builds without the parent folder.

## Environments

`APP_ENV` picks the API (`app.config.ts`); EAS profiles set it.

| APP_ENV          | API                                                    | EAS profile |
| ---------------- | ------------------------------------------------------ | ----------- |
| `mock` (default) | `http://localhost:4010` (Android emulator: `10.0.2.2`) | development |
| `staging`        | `https://staging-api.kungubook.app/v1`                 | preview     |
| `production`     | `https://api.kungubook.app/v1`                         | production  |

`EXPO_PUBLIC_API_URL` overrides the URL. For example, use your Mac's LAN IP so a physical phone can reach `pnpm mock`.

## Layout

```
src/app/            routes: (tabs)/index · activity · money · insights, add (+ sheet)
src/ui/             design-system components (colours only via useTheme(); hex literals fail lint)
src/theme/          generated tokens + ThemeProvider/useTheme()
src/lib/money/      formatMoney, parseMoney, amortize (pure TS, unit-tested)
src/api/            spec copy, generated types, openapi-fetch wrapper (auth, refresh, X-App-Version, errors, 426)
src/features/       feature hooks (accounts …)
mocks/              seed (Keza Uwase) + stateful MSW handlers for tests
scripts/            api-sync, tokens
```

`src/lib`, `src/theme/tokens.ts` and `src/api` have no React Native imports, so they can move into a shared package when the web repo starts.

## Manual steps (not done here)

- **Expo account / EAS:** run `npx eas-cli@latest login` and then `npx eas-cli@latest init`. This creates the project and its `projectId`; set it as `EAS_PROJECT_ID` or add it to `app.config.ts`. Then `eas build --profile development`.
- **CI contract check:** once the backend publishes its spec, set the repository variable `API_SPEC_URL` so the `oasdiff` step runs.
# kungubook-app
