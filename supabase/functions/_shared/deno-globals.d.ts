/**
 * Minimal ambient globals for the narrow `tsc` gate over the shared SMS helpers.
 * See supabase/functions/tsconfig.shared.json and
 * docs/sms-upgrade/15-TYPECHECK-REMEDIATION-PLAN.md.
 *
 * Deliberately not `"lib": ["dom"]`. The DOM lib would also resolve `window`,
 * `document` and `fetch`, none of which mean what they mean in a browser under
 * the Supabase Edge Runtime — so it would let a genuine mistake through in
 * exchange for the one global these files actually need.
 *
 * Declare only what the checked files use. If a helper starts using another
 * runtime global, add it here on purpose rather than widening the lib.
 */

declare const console: {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
};

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare class URL {
  constructor(url: string | URL, base?: string | URL);
  searchParams: URLSearchParams;
  toString(): string;
}

declare class URLSearchParams {
  constructor(init?: string | string[][] | Record<string, string> | URLSearchParams);
  has(name: string): boolean;
  get(name: string): string | null;
  set(name: string, value: string): void;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

declare class Request {
  constructor(input: string | Request, init?: RequestInit);
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  text(): Promise<string>;
}

declare class Response {
  constructor(body?: BodyInit | null, init?: ResponseInit);
  readonly status: number;
  json(): Promise<unknown>;
}

interface Headers {
  get(name: string): string | null;
}

interface RequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

interface ResponseInit {
  status?: number;
  headers?: HeadersInit;
}

type HeadersInit = Headers | Record<string, string> | string[][];
type BodyInit = string | Blob | ArrayBuffer | ArrayBufferView | FormData | URLSearchParams | ReadableStream;
