// Shared HTTP plumbing: request context, body reading, JSON replies, auth and
// pagination. Every reply carries a non-empty X-GitHub-Request-Id; every REST
// reply is application/json, never HTML.

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { VIEWER_LOGIN } from './store.ts';

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  /** Decoded path segments (no leading empty segment). */
  segments: string[];
  /** Parsed query parameters (first value wins). */
  query: URLSearchParams;
  /** Raw request body (null when no body was sent). */
  body: Buffer | null;
  /** The request id sent on every reply. */
  requestId: string;
  /** The viewer login when the request is authenticated, else null. */
  login: string | null;
}

const JSON_TYPE = 'application/json; charset=utf-8';

/** The bearer token the suite presents, when the trial environment set it. */
export function expectedToken(): string {
  return process.env.MAKEFUN_SHOP_TOKEN ?? '';
}

/** True when the Authorization header carries a token this server accepts. */
export function isAuthenticated(req: IncomingMessage): boolean {
  const header = (req.headers.authorization ?? '').trim();
  const expected = expectedToken();
  const bearer = /^Bearer\s+(.+)$/.exec(header);
  if (bearer !== null) {
    const token = bearer[1]!.trim();
    if (token === '') return false;
    // In a trial the env sets MAKEFUN_SHOP_TOKEN: only that exact token is valid.
    // Locally (no env token) any non-empty bearer token is the viewer, so the
    // local runner works with whatever --token it passes.
    if (expected !== '') return token === expected;
    return true;
  }
  // Real git authenticates with HTTP Basic (token as the password, any username),
  // as GitHub does. The suite's own clients send Bearer; accept both.
  const basic = /^Basic\s+(.+)$/.exec(header);
  if (basic !== null) {
    let decoded: string;
    try {
      decoded = Buffer.from(basic[1]!, 'base64').toString('utf8');
    } catch {
      return false;
    }
    const colon = decoded.indexOf(':');
    const password = colon < 0 ? decoded : decoded.slice(colon + 1);
    if (password === '') return false;
    if (expected !== '') return password === expected;
    return true;
  }
  return false;
}

let requestCounter = 0;

export function newRequestId(): string {
  requestCounter += 1;
  return `${requestCounter.toString(16)}${randomBytes(6).toString('hex')}`;
}

/** Read the whole request body (null when the request sent none). */
export function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total > 128 * 1024 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (chunks.length === 0) resolve(null);
      else resolve(Buffer.concat(chunks, total));
    });
    req.on('error', reject);
  });
}

/** Parse a JSON body, or null when the body is absent. Throws on malformed JSON. */
export function parseJsonBody(ctx: Ctx): unknown {
  if (ctx.body === null || ctx.body.length === 0) return null;
  return JSON.parse(ctx.body.toString('utf8'));
}

/** Send a JSON reply with the standard headers. */
export function sendJson(ctx: Ctx, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  const text = `${JSON.stringify(body)}\n`;
  ctx.res.writeHead(status, {
    'content-type': JSON_TYPE,
    'content-length': Buffer.byteLength(text),
    'x-github-request-id': ctx.requestId,
    ...extraHeaders,
  });
  ctx.res.end(text);
}

/** Send raw bytes with an explicit content type (git smart HTTP). */
export function sendBytes(ctx: Ctx, status: number, body: Buffer, contentType: string, extraHeaders: Record<string, string> = {}): void {
  ctx.res.writeHead(status, {
    'content-type': contentType,
    'content-length': body.length,
    'x-github-request-id': ctx.requestId,
    ...extraHeaders,
  });
  ctx.res.end(body);
}

/** A JSON error body: {"message": ...}. */
export function sendError(ctx: Ctx, status: number, message: string): void {
  sendJson(ctx, status, { message });
}

/** 401 {"message": ...} for a missing or wrong token. The WWW-Authenticate header
 * tells git/curl to retry with Basic auth (token as the password). */
export function unauthorized(ctx: Ctx): void {
  sendJson(ctx, 401, { message: 'Requires authentication' }, { 'www-authenticate': 'Basic realm="forge"' });
}

/** Require auth; returns the login or sends 401 and returns null. */
export function requireAuth(ctx: Ctx): string | null {
  if (ctx.login === null) {
    unauthorized(ctx);
    return null;
  }
  return ctx.login;
}

/** The path of a request URL, split into decoded segments. */
export function pathSegments(req: IncomingMessage): string[] {
  let pathname = '/';
  try {
    pathname = new URL(req.url ?? '/', 'http://entry').pathname;
  } catch {
    pathname = '/';
  }
  return pathname
    .split('/')
    .filter((part) => part !== '')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

/** Parse `page`/`per_page` query params the GitHub way (defaults 1/30, per_page capped at 100). */
export function pagination(query: URLSearchParams): { page: number; perPage: number } {
  const pageRaw = Number(query.get('page') ?? '1');
  const perRaw = Number(query.get('per_page') ?? '30');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;
  const perPage = Number.isFinite(perRaw) && perRaw >= 1 ? Math.min(100, Math.trunc(perRaw)) : 30;
  return { page, perPage };
}

/** Slice a list into one page; returns the page and the total page count. */
export function paginate<T>(items: readonly T[], page: number, perPage: number): { pageItems: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const start = (page - 1) * perPage;
  return { pageItems: items.slice(start, start + perPage), totalPages };
}

/** Build a GitHub-style Link header for a paginated list (absolute, same origin). */
export function linkHeader(ctx: Ctx, basePath: string, page: number, perPage: number, totalPages: number, extra: Record<string, string> = {}): string {
  const host = ctx.req.headers.host ?? 'localhost';
  const params = new URLSearchParams({ ...extra, per_page: String(perPage) });
  const urlFor = (p: number): string => {
    const q = new URLSearchParams(params);
    q.set('page', String(p));
    return `http://${host}${basePath}?${q.toString()}`;
  };
  const links: string[] = [];
  if (page < totalPages) links.push(`<${urlFor(page + 1)}>; rel="next"`);
  if (totalPages > 1) links.push(`<${urlFor(totalPages)}>; rel="last"`);
  if (page > 1) links.push(`<${urlFor(1)}>; rel="first"`);
  if (page > 1) links.push(`<${urlFor(page - 1)}>; rel="prev"`);
  return links.join(', ');
}

/** The viewer login for an authenticated request (the token always names the viewer). */
export function viewerLogin(): string {
  return VIEWER_LOGIN;
}
