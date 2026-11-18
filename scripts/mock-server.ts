/**
 * `pnpm mock` — the local API for development.
 *
 *   :4010  stateful layer: the MSW handlers in mocks/handlers.ts (auth, me, settings, devices, accounts,
 *          transactions) answer from an in-memory database, so sign-up, new accounts and so on are remembered.
 *   :4011  Prism, serving src/api/openapi.yaml; every route the handlers don't cover is forwarded here.
 *
 * State lives in memory until the server stops. The seeded demo user is keza@example.com / kungubook-demo.
 * `pnpm mock:prism` runs plain Prism on :4010 instead.
 */
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage } from 'node:http';
import { getResponse } from 'msw';
import { createHandlers, createMockDb } from '../mocks/handlers';

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const PRISM_PORT = PORT + 1;
const ORIGIN = `http://localhost:${PORT}`;

const db = createMockDb();
const handlers = createHandlers(ORIGIN, db);

const prism = spawn(
  'pnpm',
  ['exec', 'prism', 'mock', 'src/api/openapi.yaml', '--port', String(PRISM_PORT), '--host', '127.0.0.1', '--errors'],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && chunks.length > 0;
  return new Request(new URL(req.url ?? '/', ORIGIN), {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    const request = await toRequest(req);
    let response = await getResponse(handlers, request.clone());
    let via = 'state';
    if (!response) {
      const target = new URL(request.url);
      target.port = String(PRISM_PORT);
      target.hostname = '127.0.0.1';
      response = await fetch(new Request(target, request));
      via = 'prism';
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    console.log(`${req.method} ${req.url} → ${response.status} (${via}, ${Date.now() - started} ms)`);
  } catch (e) {
    console.error(`${req.method} ${req.url} failed:`, e instanceof Error ? e.message : e);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'unavailable', message: 'Mock server error' } }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`KunguBook mock API on http://localhost:${PORT} (stateful) → Prism on :${PRISM_PORT}`);
  console.log('Demo user: keza@example.com / kungubook-demo');
});

const stop = () => {
  prism.kill();
  server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
