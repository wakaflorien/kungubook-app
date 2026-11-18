/**
 * `pnpm api:insomnia` — build an Insomnia collection from the API contract (src/api/openapi.yaml).
 *
 * Writes api-collections/insomnia.json (Insomnia export v4: Application menu → Import).
 * Folders follow the spec's tags; each request has its auth, headers, sample body and the query
 * parameters (off by default). Environments: Mock (localhost), Mock (Android emulator), Staging.
 * Sign-in is automatic: `access_token` re-runs "Sign in" when it is older than 14 minutes.
 *
 * The collection is generated, never hand-edited: once the backend publishes its spec,
 * `pnpm api:sync` replaces src/api/openapi.yaml and this script rebuilds the collection from it.
 * `pnpm api:insomnia --check` fails if the committed collection is stale (CI).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

type Schema = Record<string, any>;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = resolve(root, 'src/api/openapi.yaml');
const outPath = resolve(root, 'api-collections/insomnia.json');
const check = process.argv.includes('--check');

const spec = parse(readFileSync(specPath, 'utf8')) as Schema;
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Fixed IDs keep the file stable between runs (Insomnia only needs them to be unique). */
const WS = 'wrk_kungubook';
const BASE_ENV = 'env_kungubook_base';
const LOGIN = 'req_auth_login';
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

/** Sample IDs from the mock's seed data (Keza Uwase's first account and transaction). */
const SAMPLE_IDS: Record<string, string> = {
  account_id: '0193a1b2-0000-7000-8000-000000000a01',
  transaction_id: '0193a1b2-0000-7000-8000-000000000b01',
};
const SAMPLE_ID = '0193a1b2-0000-7000-8000-000000000001';

// ------------------------------------------------------------------ schema → sample value

function deref(s: Schema | undefined): Schema {
  let cur = s ?? {};
  for (let i = 0; cur.$ref && i < 10; i++) {
    const path = String(cur.$ref).replace(/^#\//, '').split('/');
    cur = path.reduce<Schema>((node, key) => node?.[key], spec) ?? {};
  }
  return cur;
}

function merged(s: Schema): Schema {
  const d = deref(s);
  if (!d.allOf) return d;
  const out: Schema = { type: 'object', properties: {}, required: [] };
  for (const part of d.allOf.map(merged)) {
    Object.assign(out.properties, part.properties);
    out.required.push(...(part.required ?? []));
    if (part.example !== undefined) out.example = part.example;
  }
  return out;
}

/** Path-segment → env variable: `/accounts/{id}` → `account_id`, `/imports/{id}/rows/{rowId}` → `row_id`. */
function singular(word: string) {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}
/** Values for the spec's string patterns (no example in the spec). */
const PATTERN_SAMPLES: Record<string, string> = {
  '^\\d{4}-\\d{2}$': '2026-11',
  '^\\d{2}:\\d{2}$': '22:00',
  '^[a-f0-9]{64}$': '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  '^\\+[1-9]\\d{6,14}$': '+250788000000',
  '^[A-Z]{2}$': 'RW',
  '^[A-Z]{3}$': 'RWF',
};
const idVars = new Set<string>(Object.keys(SAMPLE_IDS));

function sample(raw: Schema | undefined, name = '', depth = 0, isCreate = false): unknown {
  const s = merged(raw ?? {});
  // References to things the user already has use the environment's IDs.
  if (name.endsWith('_id') && idVars.has(name)) return `{{ _.${name} }}`;
  if (name === 'password' || name === 'new_password') return '{{ _.password }}';
  if (name === 'id' && isCreate) return "{% uuid 'v4' %}";
  if (s.example !== undefined) return s.example;
  if (s.examples?.[0] !== undefined) return s.examples[0];
  if (s.default !== undefined) return s.default;
  if (s.enum) return s.enum[0];
  const variant = (s.oneOf ?? s.anyOf)?.map(deref).find((v: Schema) => v.type !== 'null');
  if (variant) return sample(variant, name, depth, isCreate);
  const type = Array.isArray(s.type) ? s.type.find((t: string) => t !== 'null') : s.type;
  switch (s.format) {
    case 'uuid':
      return SAMPLE_ID;
    case 'date-time':
      return '2026-11-17T09:42:10Z';
    case 'date':
      return '2026-11-17';
    case 'email':
      return 'keza@example.com';
  }
  if (type === 'array') {
    if (depth > 3) return [];
    const item = sample(s.items, singular(name), depth + 1);
    return Array.from({ length: Math.max(1, s.minItems ?? 1) }, () => item);
  }
  if (type === 'object' || s.properties) {
    if (depth > 3) return {};
    const props = s.properties ?? {};
    const required: string[] = s.required ?? [];
    // Creates and required-only bodies: the required fields plus ones with a documented example.
    const keys = Object.keys(props).filter(
      (k) => required.includes(k) || !required.length || deref(props[k]).example !== undefined,
    );
    return Object.fromEntries(keys.map((k) => [k, sample(props[k], k, depth + 1, isCreate && depth === 0)]));
  }
  // Money fields need a positive amount to pass validation (RWF 10,000).
  if (type === 'integer' || type === 'number')
    return /amount|limit|target|price|value/.test(name) ? Math.max(s.minimum ?? 0, 10000) : (s.minimum ?? 0);
  if (type === 'boolean') return false;
  if (type === 'string' && s.pattern) return PATTERN_SAMPLES[s.pattern] ?? '';
  // Tokens from Apple/Google: any non-empty string passes the mock.
  if (type === 'string') return /token/.test(name) ? `example-${name.replace(/_/g, '-')}` : '';
  return null;
}

// ------------------------------------------------------------------ resources

const now = 1_763_400_000_000; // fixed so regenerating doesn't change the file
const resources: Schema[] = [];

const tags: { name: string; description?: string }[] = spec.tags ?? [];
const folderId = (tag: string) => `fld_${slug(tag)}`;
tags.forEach((tag, i) =>
  resources.push({
    _id: folderId(tag.name),
    _type: 'request_group',
    parentId: WS,
    name: tag.name,
    description: tag.description ?? '',
    metaSortKey: i,
    created: now,
    modified: now,
  }),
);

/** Path params → environment variables named after the resource they point at. */
function templatedPath(path: string) {
  const segments = path.split('/');
  return segments
    .map((seg, i) => {
      const m = /^\{(.+)\}$/.exec(seg);
      if (!m) return seg;
      const param = m[1]!;
      const v =
        param === 'id'
          ? `${singular(segments[i - 1]!.replace(/-/g, '_'))}_id`
          : slug(param.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/_?id$/i, '_id'));
      const name = v.endsWith('_id') ? v : `${v}_id`;
      idVars.add(name);
      return `{{ _.${name} }}`;
    })
    .join('/');
}
// First pass so request bodies can refer to every ID variable.
Object.keys(spec.paths).forEach(templatedPath);

let sortKey = 0;
for (const [path, item] of Object.entries<Schema>(spec.paths)) {
  for (const method of METHODS) {
    const op: Schema | undefined = item[method];
    if (!op) continue;
    const tag: string = op.tags?.[0] ?? 'Other';
    if (!tags.some((t) => t.name === tag)) {
      tags.push({ name: tag });
      resources.push({ _id: folderId(tag), _type: 'request_group', parentId: WS, name: tag, metaSortKey: tags.length });
    }
    const isPublic = Array.isArray(op.security) && op.security.length === 0;
    const isCreate = method === 'post';

    const url = templatedPath(path);

    const params = [...(item.parameters ?? []), ...(op.parameters ?? [])].map(deref);
    const query = params
      .filter((p) => p.in === 'query')
      .map((p) => {
        const value = sample(p.schema, p.name);
        return {
          name: p.name,
          value: Array.isArray(value) ? value.join(',') : String(value ?? ''),
          description: p.description ?? '',
          disabled: !p.required,
        };
      });
    const headerParams = params
      .filter((p) => p.in === 'header')
      .map((p) => ({ name: p.name, value: String(sample(p.schema, p.name) ?? ''), disabled: !p.required }));

    const bodySchema = deref(op.requestBody)?.content?.['application/json']?.schema;
    let body: Schema = {};
    if (path === '/auth/login') {
      body = {
        mimeType: 'application/json',
        text: '{\n  "email": "{{ _.email }}",\n  "password": "{{ _.password }}"\n}',
      };
    } else if (path === '/auth/signup') {
      // A second send returns 409 email_taken, as the real API will.
      body = {
        mimeType: 'application/json',
        text: '{\n  "email": "new.user@example.com",\n  "password": "{{ _.password }}",\n  "display_name": "New User"\n}',
      };
    } else if (path === '/auth/password/reset') {
      body = {
        mimeType: 'application/json',
        text: '{\n  "token": "{{ _.reset_token }}",\n  "password": "{{ _.password }}"\n}',
      };
    } else if (path === '/auth/refresh') {
      body = { mimeType: 'application/json', text: '{\n  "refresh_token": "{{ _.refresh_token }}"\n}' };
    } else if (bodySchema) {
      body = { mimeType: 'application/json', text: JSON.stringify(sample(bodySchema, '', 0, isCreate), null, 2) };
    }

    const notes = [
      op.description?.trim(),
      op['x-milestone'] ? `Milestone: ${op['x-milestone']}` : '',
      isPublic ? 'No sign-in needed.' : '',
    ].filter(Boolean);

    resources.push({
      _id: path === '/auth/login' ? LOGIN : `req_${method}_${slug(path)}`,
      _type: 'request',
      parentId: folderId(tag),
      name: op.summary ?? `${method.toUpperCase()} ${path}`,
      description: notes.join('\n\n'),
      method: method.toUpperCase(),
      url: `{{ _.base_url }}${url}`,
      parameters: query,
      headers: [
        ...(body.mimeType ? [{ name: 'Content-Type', value: 'application/json' }] : []),
        { name: 'X-App-Version', value: '{{ _.app_version }}' },
        ...headerParams,
      ],
      body,
      authentication: isPublic ? {} : { type: 'bearer', token: '{{ _.access_token }}', prefix: 'Bearer' },
      metaSortKey: sortKey++,
      settingEncodeUrl: true,
      settingFollowRedirects: 'global',
      created: now,
      modified: now,
    });
  }
}

/** `{% response %}` pulls a field from the latest "Sign in" response; `when-expired` re-sends it after maxAge s. */
const fromLogin = (jsonPath: string, trigger: 'when-expired' | 'never', maxAgeS = 840) =>
  `{% response 'body', '${LOGIN}', 'b64::${Buffer.from(jsonPath).toString('base64')}::46b', '${trigger}', ${maxAgeS} %}`;

const ids = Object.fromEntries([...idVars].sort().map((v) => [v, SAMPLE_IDS[v] ?? SAMPLE_ID]));
const environments: Schema[] = [
  {
    _id: BASE_ENV,
    _type: 'environment',
    parentId: WS,
    name: 'Base Environment',
    data: {
      app_version: '1.0.0 (ios)',
      // Fictional demo user seeded in the mock (mocks/seed.ts).
      email: 'keza@example.com',
      password: 'kungubook-demo',
      // The mock accepts this reset token (from a "forgot password" email in the real API).
      reset_token: 'mock-reset-token',
      access_token: fromLogin('$.access_token', 'when-expired'),
      refresh_token: fromLogin('$.refresh_token', 'never'),
      ...ids,
    },
    dataPropertyOrder: null,
    color: null,
    isPrivate: false,
    metaSortKey: 0,
  },
  ...[
    ['mock', 'Mock (localhost)', 'http://localhost:4010', '#2E7D5B'],
    ['mock_android', 'Mock (Android emulator)', 'http://10.0.2.2:4010', '#2E7D5B'],
    ['staging', 'Staging (not live yet)', 'https://staging-api.kungubook.app/v1', '#B26B00'],
  ].map(([id, name, url, color], i) => ({
    _id: `env_kungubook_${id}`,
    _type: 'environment',
    parentId: BASE_ENV,
    name,
    data: { base_url: url },
    dataPropertyOrder: null,
    color,
    isPrivate: false,
    metaSortKey: i + 1,
  })),
];

const workspace = {
  _id: WS,
  _type: 'workspace',
  parentId: null,
  name: 'KunguBook API',
  description: [
    `Generated from ${relative(root, specPath)} (${spec.info?.title} ${spec.info?.version}) by \`pnpm api:insomnia\`.`,
    'Pick an environment, then send any request: sign-in happens on its own with the demo user.',
    'Start the mock first with `pnpm mock`. Auth, me, devices, accounts and transactions keep state until it restarts;',
    'other routes return example data from the spec. Regenerated from the real API spec once the backend publishes it.',
  ].join('\n'),
  scope: 'collection',
  created: now,
  modified: now,
};

const out = {
  _type: 'export',
  __export_format: 4,
  __export_date: new Date(now).toISOString(),
  __export_source: 'kungubook-app.api-insomnia',
  resources: [workspace, ...environments, ...resources],
};
const json = `${JSON.stringify(out, null, 2)}\n`;

if (check) {
  let current = '';
  try {
    current = readFileSync(outPath, 'utf8');
  } catch {
    /* missing → stale */
  }
  if (current !== json) {
    console.error(`${relative(root, outPath)} is stale. Run \`pnpm api:insomnia\` and commit it.`);
    process.exit(1);
  }
  console.log(`${relative(root, outPath)} is up to date.`);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  const requests = resources.filter((r) => r._type === 'request').length;
  console.log(`Wrote ${relative(root, outPath)}: ${requests} requests in ${tags.length} folders.`);
}
