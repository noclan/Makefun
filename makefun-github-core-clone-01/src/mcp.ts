// MCP (Model Context Protocol), Streamable HTTP: server/discover (2026-07-28),
// the legacy initialize handshake, tools/list and tools/call. The tools act on
// the same store as the REST surface. JSON-RPC errors ride HTTP 200, except a
// malformed JSON body, which is HTTP 400 with -32700.

import { requireAuth, sendJson, type Ctx } from './http.ts';
import { issueJson, pullJson, repoJson } from './rest.ts';
import { type Repo, type Store } from './store.ts';

const REVISION = '2026-07-28';
const SUPPORTED_REVISIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'forge', version: '1.0.0' };

interface ToolDef {
  name: string;
  description: string;
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required: string[];
  run: (store: Store, args: Record<string, unknown>) => Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolve {owner, repo} or {full_name} into a repo, or null. */
function repoFromArgs(store: Store, args: Record<string, unknown>): Repo | null {
  const owner = typeof args.owner === 'string' ? args.owner : null;
  const repoName = typeof args.repo === 'string' ? args.repo : null;
  if (owner !== null && repoName !== null) return store.getRepo(owner, repoName) ?? null;
  const fullName = typeof args.full_name === 'string' ? args.full_name : null;
  if (fullName !== null) {
    const slash = fullName.indexOf('/');
    if (slash > 0) return store.getRepo(fullName.slice(0, slash), fullName.slice(slash + 1)) ?? null;
  }
  return null;
}

function toolResult(data: Record<string, unknown>): Record<string, unknown> {
  const text = JSON.stringify(data);
  return { content: [{ type: 'text', text }], structuredContent: data };
}

function toolError(message: string): Record<string, unknown> {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const TOOLS: ToolDef[] = [
  {
    name: 'create_repo',
    description: 'Create a new repository for the authenticated user.',
    properties: {
      name: { type: 'string', description: 'The name of the repository.' },
      description: { type: 'string', description: 'A short description of the repository.' },
      private: { type: 'boolean', description: 'Whether the repository is private.' },
      owner: { type: 'string', description: 'The owner of the repository (defaults to the authenticated user).' },
    },
    required: ['name'],
    run: (store, args) => {
      const name = typeof args.name === 'string' ? args.name.trim() : '';
      if (name === '') throw new Error('name is required');
      const owner = typeof args.owner === 'string' && args.owner !== '' ? args.owner : 'adaiversen';
      if (store.getRepo(owner, name) !== undefined) throw new Error('Repository already exists');
      const repo = store.createRepo(owner, name, {
        description: typeof args.description === 'string' ? args.description : '',
        private: args.private === true,
      });
      return repoJson(repo);
    },
  },
  {
    name: 'get_repo',
    description: 'Get a repository by owner and name.',
    properties: {
      owner: { type: 'string', description: 'The repository owner.' },
      repo: { type: 'string', description: 'The repository name.' },
      full_name: { type: 'string', description: 'The repository full name (owner/repo), an alternative to owner and repo.' },
    },
    required: ['owner', 'repo'],
    run: (store, args) => {
      const repo = repoFromArgs(store, args);
      if (repo === null) throw new Error('Repository not found');
      return repoJson(repo);
    },
  },
  {
    name: 'create_issue',
    description: 'Create an issue in a repository.',
    properties: {
      owner: { type: 'string', description: 'The repository owner.' },
      repo: { type: 'string', description: 'The repository name.' },
      full_name: { type: 'string', description: 'The repository full name (owner/repo), an alternative to owner and repo.' },
      title: { type: 'string', description: 'The issue title.' },
      body: { type: 'string', description: 'The issue body.' },
    },
    required: ['owner', 'repo', 'title'],
    run: (store, args) => {
      const repo = repoFromArgs(store, args);
      if (repo === null) throw new Error('Repository not found');
      const title = typeof args.title === 'string' ? args.title.trim() : '';
      if (title === '') throw new Error('title is required');
      const number = repo.seq;
      repo.seq += 1;
      const issue = {
        id: store.nextGlobalId,
        number,
        title,
        body: typeof args.body === 'string' ? args.body : '',
        state: 'open' as const,
        labels: [] as string[],
        createdSeq: number,
      };
      store.nextGlobalId += 1;
      repo.issues.set(number, issue);
      return issueJson(repo, issue);
    },
  },
  {
    name: 'list_issues',
    description: 'List the issues of a repository.',
    properties: {
      owner: { type: 'string', description: 'The repository owner.' },
      repo: { type: 'string', description: 'The repository name.' },
      full_name: { type: 'string', description: 'The repository full name (owner/repo), an alternative to owner and repo.' },
      state: { type: 'string', description: 'Filter by state: open, closed or all.', enum: ['open', 'closed', 'all'] },
    },
    required: ['owner', 'repo'],
    run: (store, args) => {
      const repo = repoFromArgs(store, args);
      if (repo === null) throw new Error('Repository not found');
      const state = typeof args.state === 'string' ? args.state : 'open';
      const issues = [...repo.issues.values()]
        .filter((issue) => state === 'all' || issue.state === state)
        .sort((a, b) => b.number - a.number)
        .map((issue) => issueJson(repo, issue));
      return { issues };
    },
  },
  {
    name: 'create_pull_request',
    description: 'Open a pull request in a repository.',
    properties: {
      owner: { type: 'string', description: 'The repository owner.' },
      repo: { type: 'string', description: 'The repository name.' },
      full_name: { type: 'string', description: 'The repository full name (owner/repo), an alternative to owner and repo.' },
      title: { type: 'string', description: 'The pull request title.' },
      head: { type: 'string', description: 'The head branch name.' },
      base: { type: 'string', description: 'The base branch name.' },
      body: { type: 'string', description: 'The pull request body.' },
    },
    required: ['owner', 'repo', 'title', 'head', 'base'],
    run: (store, args) => {
      const repo = repoFromArgs(store, args);
      if (repo === null) throw new Error('Repository not found');
      const title = typeof args.title === 'string' ? args.title.trim() : '';
      const head = typeof args.head === 'string' ? args.head : '';
      const base = typeof args.base === 'string' ? args.base : '';
      if (title === '' || head === '' || base === '') throw new Error('title, head and base are required');
      const headTip = repo.refs.get(`refs/heads/${head}`);
      const baseTip = repo.refs.get(`refs/heads/${base}`);
      if (headTip === undefined || baseTip === undefined) throw new Error('head or base branch does not exist');
      const number = repo.seq;
      repo.seq += 1;
      const pull = {
        id: store.nextGlobalId,
        number,
        title,
        body: typeof args.body === 'string' ? args.body : '',
        state: 'open' as const,
        headRef: head,
        baseRef: base,
        baseSha: baseTip,
        merged: false,
        mergedAt: null as string | null,
        mergeCommitSha: null as string | null,
        createdSeq: number,
      };
      store.nextGlobalId += 1;
      repo.pulls.set(number, pull);
      return pullJson(repo, pull);
    },
  },
  {
    name: 'merge_pull_request',
    description: 'Merge a pull request with a squash commit.',
    properties: {
      owner: { type: 'string', description: 'The repository owner.' },
      repo: { type: 'string', description: 'The repository name.' },
      full_name: { type: 'string', description: 'The repository full name (owner/repo), an alternative to owner and repo.' },
      pull_number: { type: 'integer', description: 'The pull request number.' },
    },
    required: ['owner', 'repo', 'pull_number'],
    run: (store, args) => {
      const repo = repoFromArgs(store, args);
      if (repo === null) throw new Error('Repository not found');
      const number = Number(args.pull_number);
      if (!Number.isSafeInteger(number) || number <= 0) throw new Error('pull_number is required');
      const pull = repo.pulls.get(number);
      if (pull === undefined) throw new Error('Pull request not found');
      if (pull.state === 'closed') throw new Error('Pull request is already merged or closed');
      if (store.pullConflicts(repo, pull)) throw new Error('merge conflict');
      const mergeOid = store.mergePull(repo, pull);
      if (mergeOid === null) throw new Error('merge conflict');
      pull.state = 'closed';
      pull.merged = true;
      pull.mergedAt = '2025-01-01T00:00:00.000Z';
      pull.mergeCommitSha = mergeOid;
      return { merged: true, sha: mergeOid, message: 'Pull request successfully merged' };
    },
  },
  {
    name: 'list_repos',
    description: 'List the repositories of the authenticated user.',
    properties: {},
    required: [],
    run: (store) => ({ repos: store.reposOf('adaiversen').map(repoJson) }),
  },
  {
    name: 'get_issue',
    description: 'Get one issue of a repository by number.',
    properties: {
      owner: { type: 'string', description: 'The repository owner.' },
      repo: { type: 'string', description: 'The repository name.' },
      full_name: { type: 'string', description: 'The repository full name (owner/repo), an alternative to owner and repo.' },
      issue_number: { type: 'integer', description: 'The issue number.' },
    },
    required: ['owner', 'repo', 'issue_number'],
    run: (store, args) => {
      const repo = repoFromArgs(store, args);
      if (repo === null) throw new Error('Repository not found');
      const number = Number(args.issue_number);
      const issue = repo.issues.get(number);
      if (issue === undefined) throw new Error('Issue not found');
      return issueJson(repo, issue);
    },
  },
  {
    name: 'list_pull_requests',
    description: 'List the pull requests of a repository.',
    properties: {
      owner: { type: 'string', description: 'The repository owner.' },
      repo: { type: 'string', description: 'The repository name.' },
      full_name: { type: 'string', description: 'The repository full name (owner/repo), an alternative to owner and repo.' },
      state: { type: 'string', description: 'Filter by state: open, closed or all.', enum: ['open', 'closed', 'all'] },
    },
    required: ['owner', 'repo'],
    run: (store, args) => {
      const repo = repoFromArgs(store, args);
      if (repo === null) throw new Error('Repository not found');
      const state = typeof args.state === 'string' ? args.state : 'open';
      const pulls = [...repo.pulls.values()]
        .filter((pull) => state === 'all' || pull.state === state)
        .sort((a, b) => a.number - b.number)
        .map((pull) => pullJson(repo, pull));
      return { pull_requests: pulls };
    },
  },
];

function toolsListResult(): Record<string, unknown> {
  return {
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: { type: 'object', properties: tool.properties, required: tool.required },
    })),
  };
}

function rpcResult(ctx: Ctx, id: unknown, result: unknown): void {
  sendJson(ctx, 200, { jsonrpc: '2.0', id, result });
}

function rpcError(ctx: Ctx, id: unknown, code: number, message: string, data?: unknown): void {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) error.data = data;
  sendJson(ctx, 200, { jsonrpc: '2.0', id, error });
}

/** POST /mcp */
export function handleMcp(ctx: Ctx, store: Store): void {
  if (requireAuth(ctx) === null) return;
  let body: unknown;
  try {
    body = ctx.body === null || ctx.body.length === 0 ? null : JSON.parse(ctx.body.toString('utf8'));
  } catch {
    sendJson(ctx, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  if (!isRecord(body) || typeof body.method !== 'string') {
    const id = isRecord(body) ? (body.id ?? null) : null;
    rpcError(ctx, id, -32600, 'Invalid Request');
    return;
  }
  const id = body.id ?? null;
  const method = body.method;
  const params = isRecord(body.params) ? body.params : {};

  // Notifications carry no id and expect no response body.
  if (id === null) {
    ctx.res.writeHead(202, { 'x-github-request-id': ctx.requestId });
    ctx.res.end();
    return;
  }

  if (method === 'server/discover') {
    return rpcResult(ctx, id, {
      protocolVersion: REVISION,
      supportedVersions: [REVISION],
      serverInfo: SERVER_INFO,
      capabilities: { tools: {} },
      _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO },
    });
  }
  if (method === 'initialize') {
    const offered = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
    if (!SUPPORTED_REVISIONS.includes(offered)) {
      return rpcError(ctx, id, -32022, `Unsupported protocol version: ${offered}`, { supported: SUPPORTED_REVISIONS });
    }
    return rpcResult(ctx, id, {
      protocolVersion: offered,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === 'ping') {
    return rpcResult(ctx, id, {});
  }
  if (method === 'tools/list') {
    return rpcResult(ctx, id, toolsListResult());
  }
  if (method === 'tools/call') {
    const name = typeof params.name === 'string' ? params.name : '';
    const args = isRecord(params.arguments) ? params.arguments : {};
    const tool = TOOLS.find((candidate) => candidate.name === name);
    if (tool === undefined) {
      return rpcError(ctx, id, -32602, `Unknown tool: ${name}`);
    }
    const missing = tool.required.filter((field) => args[field] === undefined || args[field] === null || args[field] === '');
    if (missing.length > 0) {
      return rpcResult(ctx, id, toolError(`Missing required arguments: ${missing.join(', ')}`));
    }
    try {
      const data = tool.run(store, args);
      return rpcResult(ctx, id, toolResult(data));
    } catch (err) {
      return rpcResult(ctx, id, toolError((err as Error).message));
    }
  }
  return rpcError(ctx, id, -32601, `Method not found: ${method}`);
}
