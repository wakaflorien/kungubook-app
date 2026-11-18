import { setupServer } from 'msw/node';
import { createHandlers, createMockDb, type MockDb } from './handlers';

export const MOCK_BASE_URL = 'http://mock.kungubook.test';

/** An MSW server with a fresh in-memory database, for Vitest. */
export function createMockServer(baseUrl = MOCK_BASE_URL) {
  const db: MockDb = createMockDb();
  const server = setupServer(...createHandlers(baseUrl, db));
  return { server, db, baseUrl };
}

export { createHandlers, createMockDb } from './handlers';
export type { MockDb } from './handlers';
export * as seed from './seed';
