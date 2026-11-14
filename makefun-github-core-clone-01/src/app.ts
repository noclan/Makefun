// The forge's HTTP server: one Store for the process, routing by path.
//   GET  /healthz                                  the env's boot probe
//   /api/v3/*                                       REST v3 (src/rest.ts)
//   POST /api/graphql                               GraphQL (src/graphql.ts)
//   POST /mcp                                       MCP (src/mcp.ts)
//   /<owner>/<repo>.git/info/refs                   git advertisement
//   /<owner>/<repo>.git/git-upload-pack             git fetch / ls-refs
//   /<owner>/<repo>.git/git-receive-pack            git push
// Anything else is a JSON 404. A handler that throws never kills the server:
// it answers 500 JSON and keeps serving.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { handleInfoRefs, handleReceivePack, handleUploadPack } from './gitproto.ts';
import { handleGraphql } from './graphql.ts';
import {
  isAuthenticated,
  newRequestId,
  pathSegments,
  readBody,
  sendError,
  sendJson,
  viewerLogin,
  type Ctx,
} from './http.ts';
import { handleMcp } from './mcp.ts';
import { handleRest } from './rest.ts';
import { Store } from './store.ts';

async function handleRequest(req: IncomingMessage, res: ServerResponse, store: Store): Promise<void> {
  const method = req.method ?? 'GET';
  const ctx: Ctx = {
    req,
    res,
    method,
    segments: pathSegments(req),
    query: new URL(req.url ?? '/', 'http://entry').searchParams,
    body: null,
    requestId: newRequestId(),
    login: isAuthenticated(req) ? viewerLogin() : null,
  };
  try {
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      ctx.body = await readBody(req);
    }
    route(ctx, store);
  } catch (err) {
    process.stderr.write(`[entry] request failed: ${err instanceof Error ? err.message : String(err)}\n`);
    if (!res.headersSent) sendError(ctx, 500, 'Internal Server Error');
    else res.end();
  }
}

function route(ctx: Ctx, store: Store): void {
  const segments = ctx.segments;
  const method = ctx.method;

  if (method === 'GET' && segments.length === 1 && segments[0] === 'healthz') {
    sendJson(ctx, 200, { ok: true });
    return;
  }

  if (segments.length >= 2 && segments[0] === 'api') {
    if (segments[1] === 'v3') {
      handleRest(ctx, store);
      return;
    }
    if (segments[1] === 'graphql' && segments.length === 2 && method === 'POST') {
      handleGraphql(ctx, store);
      return;
    }
    sendError(ctx, 404, 'Not Found');
    return;
  }

  if (segments.length === 1 && segments[0] === 'mcp' && method === 'POST') {
    handleMcp(ctx, store);
    return;
  }

  // Git smart HTTP: /<owner>/<repo>.git/<service>
  if (segments.length >= 3 && segments[1]!.endsWith('.git')) {
    const owner = segments[0]!;
    const repoName = segments[1]!.slice(0, -'.git'.length);
    if (segments[2] === 'info' && segments[3] === 'refs' && segments.length === 4 && method === 'GET') {
      handleInfoRefs(ctx, store, owner, repoName);
      return;
    }
    if (segments[2] === 'git-upload-pack' && segments.length === 3 && method === 'POST') {
      handleUploadPack(ctx, store, owner, repoName);
      return;
    }
    if (segments[2] === 'git-receive-pack' && segments.length === 3 && method === 'POST') {
      handleReceivePack(ctx, store, owner, repoName);
      return;
    }
    sendError(ctx, 404, 'Not Found');
    return;
  }

  sendError(ctx, 404, 'Not Found');
}

/** Build the server. It binds nothing until the caller listens; the entry listens on an ephemeral port. */
export function createApp(): Server {
  const store = new Store();
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleRequest(req, res, store);
  });
}
