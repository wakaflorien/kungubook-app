import type { components } from './schema';

export type ErrorCode = components['schemas']['ErrorCode'];
/** Codes the client adds when the API gave no `{ error }` body. */
export type ClientErrorCode = 'network' | 'unknown';

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
    server_row?: Record<string, unknown>;
  };
}

/** An API failure with the stable `code` from `{ error: { code, message, fields? } }`. */
export class ApiError extends Error {
  readonly code: ErrorCode | ClientErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly serverRow?: Record<string, unknown>;

  constructor(init: {
    code: ErrorCode | ClientErrorCode;
    status: number;
    message?: string;
    fields?: Record<string, string>;
    serverRow?: Record<string, unknown>;
  }) {
    super(init.message ?? init.code);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.fields = init.fields;
    this.serverRow = init.serverRow;
  }
}

/** `426 upgrade_required`: this app version is too old. The UI shows a store link. */
export class UpgradeRequiredError extends ApiError {
  constructor(message?: string) {
    super({ code: 'upgrade_required', status: 426, message });
    this.name = 'UpgradeRequiredError';
  }
}

const isErrorBody = (v: unknown): v is ErrorBody =>
  typeof v === 'object' && v !== null && 'error' in v && typeof (v as ErrorBody).error === 'object';

/** Map an error response (status + parsed body) to a typed error. */
export function toApiError(status: number, body: unknown): ApiError {
  if (status === 426) {
    return new UpgradeRequiredError(isErrorBody(body) ? body.error?.message : undefined);
  }
  if (isErrorBody(body) && typeof body.error?.code === 'string') {
    return new ApiError({
      code: body.error.code as ErrorCode,
      status,
      message: body.error.message,
      fields: body.error.fields,
      serverRow: body.error.server_row,
    });
  }
  return new ApiError({ code: 'unknown', status, message: `HTTP ${status}` });
}
