---
name: verify
description: Run and drive the KunguBook app and its mock API to verify a change (iOS simulator via Expo Go, curl against pnpm mock).
---

# Verify KunguBook changes

## Mock API (socket surface)

- Start: `pnpm mock` (stateful MSW on :4010, Prism on :4011). Wait until both `curl localhost:4010/health` and `curl localhost:4011` answer.
- Restarting the mock resets all data and invalidates every token: the app then signs out to Welcome.
- Demo user: keza@example.com / kungubook-demo. `POST /auth/login` → `access_token`.
- The default shell is zsh: it does not word-split `$VAR` headers. Put curl scenarios in a `#!/bin/bash` script and run it with `bash`.
- Sync: `GET /sync/pull?since=<cursor>&limit=`, `POST /sync/push {changes:[{table, op, row:{id, version, client_updated_at, …}}]}`. Use two logins as two phones.

## App (iOS simulator, Expo Go)

- `npx expo start --ios --port 8081` in the background; it opens Expo Go on the booted simulator. Wait for "iOS Bundled" in its log.
- Sign in: Welcome → "I already have an account" (≈201,816 pt), email field ≈(201,346), password ≈(170,439), Sign in ≈(201,816).
- Simulator text input can arrive late: take a fresh screenshot before typing again, or you get doubled text. Clear with select_all + delete.
- After sign-in iOS may show "Save Password?": tap Not Now (≈127,547) before the PIN pad, or it swallows the taps.
- PIN pad: 1 ≈(105,322), 2 ≈(201,322). Tap one digit per call; check the dots before the second entry.
- Tabs: Activity ≈(131,822); + is the separate round button on the right.

## Clean up

Stop Metro (:8081) and the mock (:4010, :4011) when done.
