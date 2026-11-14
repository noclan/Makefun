// REST v3: repositories, branches, commits, contents, refs, labels, issues,
// comments and pull requests. Every reply is JSON with an X-OAuth-Scopes
// header; unknown routes and missing resources are 404 JSON {message}.
// Commit messages are presented without the trailing newline git stores.

import { parseCommit, parseTree } from './gitobj.ts';
import {
  linkHeader,
  paginate,
  pagination,
  parseJsonBody,
  requireAuth,
  sendJson,
  viewerLogin,
  type Ctx,
} from './http.ts';
import {
  MERGED_AT,
  VIEWER_ID,
  VIEWER_NAME,
  type Issue,
  type Pull,
  type Repo,
  type Store,
} from './store.ts';

const SCOPES = 'repo, user';
const CREATED_AT = '2025-01-01T00:00:00Z';

function restJson(ctx: Ctx, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  sendJson(ctx, status, body, { 'x-oauth-scopes': SCOPES, ...extraHeaders });
}

function restError(ctx: Ctx, status: number, message: string): void {
  restJson(ctx, status, { message });
}

function noContent(ctx: Ctx): void {
  ctx.res.writeHead(204, { 'x-github-request-id': ctx.requestId, 'x-oauth-scopes': SCOPES });
  ctx.res.end();
}

function userJson(login: string, id: number): Record<string, unknown> {
  return { login, id, type: 'User', site_admin: false };
}

function openIssueCount(repo: Repo): number {
  let count = 0;
  for (const issue of repo.issues.values()) if (issue.state === 'open') count += 1;
  return count;
}

export function repoJson(repo: Repo): Record<string, unknown> {
  return {
    id: repo.id,
    name: repo.name,
    full_name: `${repo.owner}/${repo.name}`,
    owner: userJson(repo.owner, repo.owner === viewerLogin() ? VIEWER_ID : 2000),
    private: repo.private,
    description: repo.description,
    default_branch: repo.defaultBranch,
    html_url: `https://github.example/${repo.owner}/${repo.name}`,
    url: `/api/v3/repos/${repo.owner}/${repo.name}`,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    pushed_at: CREATED_AT,
    has_issues: true,
    has_projects: true,
    has_wiki: true,
    has_pages: false,
    forks_count: 0,
    open_issues_count: openIssueCount(repo),
    watchers_count: 0,
    stargazers_count: 0,
    language: null,
    topics: [],
    visibility: repo.private ? 'private' : 'public',
    archived: false,
    disabled: false,
    allow_squash_merge: true,
    allow_merge_commit: true,
    allow_rebase_merge: true,
  };
}

function labelJson(repo: Repo, name: string): Record<string, unknown> {
  const label = repo.labels.get(name);
  return { name, color: label?.color ?? 'ededed', description: '' };
}

export function issueJson(repo: Repo, issue: Issue): Record<string, unknown> {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels.map((name) => labelJson(repo, name)),
    user: userJson(viewerLogin(), VIEWER_ID),
    assignee: null,
    assignees: [],
    locked: false,
    comments: (repo.comments.get(issue.number) ?? []).length,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    closed_at: issue.state === 'closed' ? CREATED_AT : null,
    html_url: `https://github.example/${repo.owner}/${repo.name}/issues/${issue.number}`,
    url: `/api/v3/repos/${repo.owner}/${repo.name}/issues/${issue.number}`,
  };
}

export function pullJson(repo: Repo, pull: Pull): Record<string, unknown> {
  const headTip = repo.refs.get(`refs/heads/${pull.headRef}`) ?? pull.baseSha;
  const baseTip = repo.refs.get(`refs/heads/${pull.baseRef}`) ?? pull.baseSha;
  return {
    id: pull.id,
    number: pull.number,
    title: pull.title,
    body: pull.body,
    state: pull.state,
    merged: pull.merged,
    merged_at: pull.mergedAt,
    merge_commit_sha: pull.mergeCommitSha,
    head: { ref: pull.headRef, sha: headTip, label: `${repo.owner}:${pull.headRef}` },
    base: { ref: pull.baseRef, sha: baseTip, label: `${repo.owner}:${pull.baseRef}` },
    user: userJson(viewerLogin(), VIEWER_ID),
    assignee: null,
    assignees: [],
    requested_reviewers: [],
    labels: [],
    draft: false,
    locked: false,
    comments: 0,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    closed_at: pull.state === 'closed' ? CREATED_AT : null,
    html_url: `https://github.example/${repo.owner}/${repo.name}/pull/${pull.number}`,
    url: `/api/v3/repos/${repo.owner}/${repo.name}/pulls/${pull.number}`,
  };
}

function parseIdentity(raw: string): { name: string; email: string; date: string } {
  const match = /^(.*?) <(.*?)> (\d+) ([+-]\d{4})$/.exec(raw);
  if (match === null) return { name: raw, email: '', date: CREATED_AT };
  const ts = Number(match[3]);
  return { name: match[1] ?? '', email: match[2] ?? '', date: new Date(ts * 1000).toISOString() };
}

function commitJson(repo: Repo, oid: string): Record<string, unknown> {
  const object = repo.objects.get(oid);
  if (object === undefined || object.type !== 'commit') return { sha: oid };
  const commit = parseCommit(object.data);
  const author = parseIdentity(commit.author);
  const committer = parseIdentity(commit.committer);
  return {
    sha: oid,
    commit: {
      message: commit.message.replace(/\n+$/, ''),
      author: { name: author.name, email: author.email, date: author.date },
      committer: { name: committer.name, email: committer.email, date: committer.date },
      tree: { sha: commit.tree },
    },
    author: userJson(VIEWER_NAME, VIEWER_ID),
    committer: userJson(VIEWER_NAME, VIEWER_ID),
    parents: commit.parents.map((sha) => ({ sha })),
    url: `/api/v3/repos/${repo.owner}/${repo.name}/commits/${oid}`,
  };
}

/** Resolve a ref query (?ref=branch|oid) to a commit oid, or null when unresolvable. */
function resolveRef(repo: Repo, ref: string | null): string | null {
  if (ref === null || ref === '') {
    return repo.refs.get(`refs/heads/${repo.defaultBranch}`) ?? null;
  }
  const branchTip = repo.refs.get(`refs/heads/${ref}`);
  if (branchTip !== undefined) return branchTip;
  const tagTip = repo.refs.get(`refs/tags/${ref}`);
  if (tagTip !== undefined) return tagTip;
  const object = repo.objects.get(ref);
  if (object !== undefined && object.type === 'commit') return ref;
  return null;
}

function getRepoOr404(ctx: Ctx, store: Store, owner: string, name: string): Repo | null {
  const repo = store.getRepo(owner, name);
  if (repo === undefined) {
    restError(ctx, 404, 'Not Found');
    return null;
  }
  return repo;
}

/** The handler for every /api/v3/* route. Segments are the decoded path parts. */
export function handleRest(ctx: Ctx, store: Store): void {
  const segments = ctx.segments;
  const method = ctx.method;
  // GET /api/v3/ and GET /api/v3/meta are public; everything else needs a token.
  const isRoot = segments.length === 2;
  const isMeta = segments.length === 3 && segments[2] === 'meta';
  if (!isRoot && !isMeta && requireAuth(ctx) === null) return;

  if (isRoot) {
    if (method !== 'GET') return restError(ctx, 404, 'Not Found');
    return restJson(ctx, 200, {
      current_user_url: '/api/v3/user',
      repository_url: '/api/v3/repos/{owner}/{repo}',
      user_url: '/api/v3/users/{username}',
      meta_url: '/api/v3/meta',
    });
  }
  if (isMeta) {
    if (method !== 'GET') return restError(ctx, 404, 'Not Found');
    return restJson(ctx, 200, { installed_version: '1.0.0', git: ['1.0.0'], verifiable_password_authentication: true });
  }

  // GET /api/v3/user
  if (segments.length === 3 && segments[2] === 'user' && method === 'GET') {
    return restJson(ctx, 200, {
      ...userJson(viewerLogin(), VIEWER_ID),
      name: VIEWER_NAME,
      email: `${viewerLogin()}@example.invalid`,
      html_url: `https://github.example/${viewerLogin()}`,
      url: '/api/v3/user',
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
    });
  }

  // POST /api/v3/user/repos | GET /api/v3/user/repos
  if (segments.length === 4 && segments[2] === 'user' && segments[3] === 'repos') {
    if (method === 'POST') return createRepo(ctx, store);
    if (method === 'GET') return listUserRepos(ctx, store);
    return restError(ctx, 404, 'Not Found');
  }

  // /api/v3/repos/{owner}/{name}[/...]
  if (segments.length >= 4 && segments[2] === 'repos') {
    return handleRepoRoutes(ctx, store, segments[3]!, segments[4]!, segments.slice(5));
  }

  return restError(ctx, 404, 'Not Found');
}

function createRepo(ctx: Ctx, store: Store): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name === '') return restError(ctx, 422, 'name is required');
  const owner = viewerLogin();
  if (store.getRepo(owner, name) !== undefined) return restError(ctx, 422, 'Repository already exists');
  const repo = store.createRepo(owner, name, {
    description: typeof input.description === 'string' ? input.description : '',
    private: input.private === true,
  });
  return restJson(ctx, 201, repoJson(repo));
}

function listUserRepos(ctx: Ctx, store: Store): void {
  const { page, perPage } = pagination(ctx.query);
  const repos = store.reposOf(viewerLogin()).map(repoJson);
  const { pageItems, totalPages } = paginate(repos, page, perPage);
  const link = linkHeader(ctx, '/api/v3/user/repos', page, perPage, totalPages);
  const headers: Record<string, string> = {};
  if (link !== '') headers.link = link;
  return restJson(ctx, 200, pageItems, headers);
}

function handleRepoRoutes(ctx: Ctx, store: Store, owner: string, name: string, rest: string[]): void {
  const method = ctx.method;
  const repo = getRepoOr404(ctx, store, owner, name);
  if (repo === null) return;

  // /api/v3/repos/{o}/{r}
  if (rest.length === 0) {
    if (method === 'GET') return restJson(ctx, 200, repoJson(repo));
    if (method === 'PATCH') return patchRepo(ctx, store, repo);
    if (method === 'DELETE') {
      store.deleteRepo(owner, name);
      return noContent(ctx);
    }
    return restError(ctx, 404, 'Not Found');
  }

  const head = rest[0]!;
  if (head === 'branches' && rest.length === 1 && method === 'GET') return listBranches(ctx, repo);
  if (head === 'commits' && rest.length === 1 && method === 'GET') return listCommits(ctx, store, repo);
  if (head === 'contents') return handleContents(ctx, store, repo, rest.slice(1));
  if (head === 'git' && rest[1] === 'refs') {
    if (rest.length === 2 && method === 'GET') return listRefs(ctx, repo);
    if (rest.length === 2 && method === 'POST') return createRef(ctx, store, repo);
    if (rest.length >= 4 && method === 'GET') return getRef(ctx, repo, rest.slice(2));
    return restError(ctx, 404, 'Not Found');
  }
  if (head === 'labels') {
    if (rest.length === 1 && method === 'GET') return listLabels(ctx, repo);
    if (rest.length === 1 && method === 'POST') return createLabel(ctx, repo);
    return restError(ctx, 404, 'Not Found');
  }
  if (head === 'issues') return handleIssues(ctx, store, repo, rest.slice(1));
  if (head === 'pulls') return handlePulls(ctx, store, repo, rest.slice(1));

  return restError(ctx, 404, 'Not Found');
}

function patchRepo(ctx: Ctx, store: Store, repo: Repo): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  if (typeof input.description === 'string') repo.description = input.description;
  if (typeof input.private === 'boolean') repo.private = input.private;
  if (typeof input.default_branch === 'string' && input.default_branch !== '') repo.defaultBranch = input.default_branch;
  return restJson(ctx, 200, repoJson(repo));
}

function listBranches(ctx: Ctx, repo: Repo): void {
  const branches: Array<Record<string, unknown>> = [];
  for (const [name, oid] of [...repo.refs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (!name.startsWith('refs/heads/')) continue;
    branches.push({ name: name.slice('refs/heads/'.length), commit: { sha: oid }, protected: false });
  }
  return restJson(ctx, 200, branches);
}

function listCommits(ctx: Ctx, store: Store, repo: Repo): void {
  const ref = ctx.query.get('sha');
  const tip = resolveRef(repo, ref);
  if (tip === null) return restJson(ctx, 200, []);
  const { page, perPage } = pagination(ctx.query);
  const history = store.commitHistory(repo, tip).map((oid) => commitJson(repo, oid));
  const { pageItems } = paginate(history, page, perPage);
  return restJson(ctx, 200, pageItems);
}

function listRefs(ctx: Ctx, repo: Repo): void {
  const refs = [...repo.refs.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, oid]) => ({ ref: name, object: { sha: oid, type: 'commit' }, url: `/api/v3/repos/${repo.owner}/${repo.name}/git/refs/${name}` }));
  return restJson(ctx, 200, refs);
}

function createRef(ctx: Ctx, store: Store, repo: Repo): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const ref = typeof input.ref === 'string' ? input.ref : '';
  const sha = typeof input.sha === 'string' ? input.sha : '';
  if (!ref.startsWith('refs/') || sha === '') return restError(ctx, 422, 'ref and sha are required');
  if (repo.refs.has(ref)) return restError(ctx, 422, 'Reference already exists');
  if (!repo.objects.has(sha)) return restError(ctx, 422, 'Object does not exist');
  repo.refs.set(ref, sha);
  store.touch(repo);
  return restJson(ctx, 201, { ref, object: { sha, type: 'commit' } });
}

function getRef(ctx: Ctx, repo: Repo, rest: string[]): void {
  const ref = `refs/${rest.join('/')}`;
  const oid = repo.refs.get(ref);
  if (oid === undefined) return restError(ctx, 404, 'Not Found');
  return restJson(ctx, 200, { ref, object: { sha: oid, type: 'commit' } });
}

function listLabels(ctx: Ctx, repo: Repo): void {
  const labels = [...repo.labels.keys()].sort().map((name) => labelJson(repo, name));
  return restJson(ctx, 200, labels);
}

function createLabel(ctx: Ctx, repo: Repo): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name === '') return restError(ctx, 422, 'name is required');
  if (repo.labels.has(name)) return restError(ctx, 422, 'Label already exists');
  const color = typeof input.color === 'string' && /^[0-9a-fA-F]{6}$/.test(input.color) ? input.color.toLowerCase() : 'ededed';
  repo.labels.set(name, { name, color });
  return restJson(ctx, 201, labelJson(repo, name));
}

// ---------------------------------------------------------------------------------------------
// contents
// ---------------------------------------------------------------------------------------------

function handleContents(ctx: Ctx, store: Store, repo: Repo, rest: string[]): void {
  const method = ctx.method;
  const path = rest.join('/');
  if (method === 'GET') return getContents(ctx, store, repo, path);
  if (method === 'PUT') return putContents(ctx, store, repo, path);
  if (method === 'DELETE') return deleteContents(ctx, store, repo, path);
  return restError(ctx, 404, 'Not Found');
}

function contentsEntry(repo: Repo, path: string, mode: string, oid: string, size: number): Record<string, unknown> {
  const name = path.split('/').pop() ?? path;
  return {
    type: mode === '40000' ? 'dir' : 'file',
    encoding: mode === '40000' ? undefined : 'base64',
    size,
    name,
    path,
    sha: oid,
    url: `/api/v3/repos/${repo.owner}/${repo.name}/contents/${path}`,
    html_url: `https://github.example/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${path}`,
  };
}

function getContents(ctx: Ctx, store: Store, repo: Repo, path: string): void {
  const tip = resolveRef(repo, ctx.query.get('ref'));
  if (tip === null) return restError(ctx, 404, 'Not Found');
  const commit = parseCommit(repo.objects.get(tip)!.data);
  if (path === '') {
    // Root directory listing.
    const object = repo.objects.get(commit.tree)!;
    const entries = parseTree(object.data).map((entry) => {
      const size = entry.mode === '40000' ? 0 : (repo.objects.get(entry.oid)?.data.length ?? 0);
      return contentsEntry(repo, entry.name, entry.mode, entry.oid, size);
    });
    return restJson(ctx, 200, entries);
  }
  const files = store.flattenTree(repo, commit.tree);
  const file = files.get(path);
  if (file !== undefined) {
    const object = repo.objects.get(file.oid)!;
    return restJson(ctx, 200, {
      ...contentsEntry(repo, path, file.mode, file.oid, object.data.length),
      content: object.data.toString('base64'),
    });
  }
  // Maybe a directory: collect the entries directly under it.
  const prefix = `${path}/`;
  const children = new Map<string, { mode: string; oid: string; size: number }>();
  for (const [filePath, entry] of files) {
    if (!filePath.startsWith(prefix)) continue;
    const restPath = filePath.slice(prefix.length);
    const slash = restPath.indexOf('/');
    if (slash < 0) children.set(restPath, { mode: entry.mode, oid: entry.oid, size: repo.objects.get(entry.oid)?.data.length ?? 0 });
    else {
      const dir = restPath.slice(0, slash);
      if (!children.has(dir)) children.set(dir, { mode: '40000', oid: '', size: 0 });
    }
  }
  if (children.size === 0) return restError(ctx, 404, 'Not Found');
  // Directory oids: find the tree oid for each child directory.
  const entries: Array<Record<string, unknown>> = [];
  for (const [name, child] of [...children.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    let oid = child.oid;
    if (child.mode === '40000') {
      oid = findSubtreeOid(repo, commit.tree, `${path}/${name}`) ?? '';
    }
    entries.push(contentsEntry(repo, `${path}/${name}`, child.mode, oid, child.size));
  }
  return restJson(ctx, 200, entries);
}

/** The tree oid of a nested directory path inside a tree, or null. */
function findSubtreeOid(repo: Repo, treeOid: string, path: string): string | null {
  const parts = path.split('/').filter((part) => part !== '');
  let current = treeOid;
  for (const part of parts) {
    const object = repo.objects.get(current);
    if (object === undefined || object.type !== 'tree') return null;
    const entry = parseTree(object.data).find((item) => item.name === part);
    if (entry === undefined) return null;
    current = entry.oid;
  }
  return current;
}

function putContents(ctx: Ctx, store: Store, repo: Repo, path: string): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const message = typeof input.message === 'string' && input.message !== '' ? input.message : `Update ${path}`;
  const contentB64 = typeof input.content === 'string' ? input.content : '';
  const branch = typeof input.branch === 'string' && input.branch !== '' ? input.branch : repo.defaultBranch;
  if (contentB64 === '') return restError(ctx, 422, 'content is required');
  let content: Buffer;
  try {
    content = Buffer.from(contentB64, 'base64');
  } catch {
    return restError(ctx, 422, 'content must be base64');
  }
  // Stale-sha guard: updating an existing file with a wrong sha is a conflict.
  const branchTip = repo.refs.get(`refs/heads/${branch}`);
  const existing = branchTip !== undefined ? store.flattenTree(repo, parseCommit(repo.objects.get(branchTip)!.data).tree).get(path) : undefined;
  const givenSha = typeof input.sha === 'string' ? input.sha : null;
  if (existing !== undefined && givenSha !== null && givenSha !== existing.oid) {
    return restError(ctx, 409, 'sha does not match');
  }
  const isUpdate = existing !== undefined;
  const { commitOid, blobOid } = store.commitFile(repo, branch, path, content, message);
  return restJson(ctx, isUpdate ? 200 : 201, {
    content: {
      name: path.split('/').pop() ?? path,
      path,
      sha: blobOid,
      size: content.length,
      type: 'file',
      encoding: 'base64',
    },
    commit: { sha: commitOid, message },
  });
}

function deleteContents(ctx: Ctx, store: Store, repo: Repo, path: string): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const message = typeof input.message === 'string' && input.message !== '' ? input.message : `Delete ${path}`;
  const branch = typeof input.branch === 'string' && input.branch !== '' ? input.branch : repo.defaultBranch;
  const givenSha = typeof input.sha === 'string' ? input.sha : null;
  const branchTip = repo.refs.get(`refs/heads/${branch}`);
  if (branchTip === undefined) return restError(ctx, 404, 'Not Found');
  const existing = store.flattenTree(repo, parseCommit(repo.objects.get(branchTip)!.data).tree).get(path);
  if (existing === undefined) return restError(ctx, 404, 'Not Found');
  if (givenSha !== null && givenSha !== existing.oid) return restError(ctx, 409, 'sha does not match');
  const { commitOid } = store.commitFile(repo, branch, path, null, message);
  return restJson(ctx, 200, { commit: { sha: commitOid, message } });
}

// ---------------------------------------------------------------------------------------------
// issues and comments
// ---------------------------------------------------------------------------------------------

function handleIssues(ctx: Ctx, store: Store, repo: Repo, rest: string[]): void {
  const method = ctx.method;
  if (rest.length === 0) {
    if (method === 'GET') return listIssues(ctx, repo);
    if (method === 'POST') return createIssue(ctx, store, repo);
    return restError(ctx, 404, 'Not Found');
  }
  const number = Number(rest[0]);
  if (!Number.isSafeInteger(number) || number <= 0) return restError(ctx, 404, 'Not Found');
  if (rest.length === 1) {
    if (method === 'GET') {
      const issue = repo.issues.get(number);
      if (issue === undefined) return restError(ctx, 404, 'Not Found');
      return restJson(ctx, 200, issueJson(repo, issue));
    }
    if (method === 'PATCH') return patchIssue(ctx, repo, number);
    return restError(ctx, 404, 'Not Found');
  }
  if (rest.length === 2 && rest[1] === 'comments') {
    if (method === 'GET') {
      const issue = repo.issues.get(number);
      if (issue === undefined) return restError(ctx, 404, 'Not Found');
      const comments = (repo.comments.get(number) ?? []).map((comment) => ({
        id: comment.id,
        body: comment.body,
        user: userJson(viewerLogin(), VIEWER_ID),
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
        html_url: `https://github.example/${repo.owner}/${repo.name}/issues/${number}#issuecomment-${comment.id}`,
      }));
      return restJson(ctx, 200, comments);
    }
    if (method === 'POST') return createComment(ctx, store, repo, number);
    return restError(ctx, 404, 'Not Found');
  }
  return restError(ctx, 404, 'Not Found');
}

function listIssues(ctx: Ctx, repo: Repo): void {
  const state = ctx.query.get('state') ?? 'open';
  const direction = ctx.query.get('direction') ?? 'desc';
  let issues = [...repo.issues.values()];
  if (state !== 'all') issues = issues.filter((issue) => issue.state === state);
  issues.sort((a, b) => (direction === 'asc' ? a.number - b.number : b.number - a.number));
  const { page, perPage } = pagination(ctx.query);
  const { pageItems } = paginate(issues, page, perPage);
  return restJson(ctx, 200, pageItems.map((issue) => issueJson(repo, issue)));
}

function validateLabels(repo: Repo, labels: unknown): string[] | null {
  if (!Array.isArray(labels)) return [];
  const names: string[] = [];
  for (const label of labels) {
    if (typeof label !== 'string') return null;
    if (!repo.labels.has(label)) return null;
    names.push(label);
  }
  return names;
}

function createIssue(ctx: Ctx, store: Store, repo: Repo): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title === '') return restError(ctx, 422, 'title is required');
  const labels = validateLabels(repo, input.labels);
  if (labels === null) return restError(ctx, 422, 'Unknown label');
  const number = repo.seq;
  repo.seq += 1;
  const issue: Issue = {
    id: store.nextGlobalId,
    number,
    title,
    body: typeof input.body === 'string' ? input.body : '',
    state: 'open',
    labels,
    createdSeq: number,
  };
  store.nextGlobalId += 1;
  repo.issues.set(number, issue);
  return restJson(ctx, 201, issueJson(repo, issue));
}

function patchIssue(ctx: Ctx, repo: Repo, number: number): void {
  const issue = repo.issues.get(number);
  if (issue === undefined) return restError(ctx, 404, 'Not Found');
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  if (typeof input.title === 'string') issue.title = input.title;
  if (typeof input.body === 'string') issue.body = input.body;
  if (typeof input.state === 'string' && (input.state === 'open' || input.state === 'closed')) issue.state = input.state;
  if (input.labels !== undefined) {
    const labels = validateLabels(repo, input.labels);
    if (labels === null) return restError(ctx, 422, 'Unknown label');
    issue.labels = labels;
  }
  return restJson(ctx, 200, issueJson(repo, issue));
}

function createComment(ctx: Ctx, store: Store, repo: Repo, number: number): void {
  const issue = repo.issues.get(number);
  if (issue === undefined) return restError(ctx, 404, 'Not Found');
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const text = typeof input.body === 'string' ? input.body : '';
  if (text === '') return restError(ctx, 422, 'body is required');
  const comment = { id: store.nextCommentId, body: text };
  store.nextCommentId += 1;
  const list = repo.comments.get(number) ?? [];
  list.push(comment);
  repo.comments.set(number, list);
  return restJson(ctx, 201, {
    id: comment.id,
    body: comment.body,
    user: userJson(viewerLogin(), VIEWER_ID),
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    html_url: `https://github.example/${repo.owner}/${repo.name}/issues/${number}#issuecomment-${comment.id}`,
  });
}

// ---------------------------------------------------------------------------------------------
// pull requests
// ---------------------------------------------------------------------------------------------

function handlePulls(ctx: Ctx, store: Store, repo: Repo, rest: string[]): void {
  const method = ctx.method;
  if (rest.length === 0) {
    if (method === 'GET') return listPulls(ctx, repo);
    if (method === 'POST') return createPull(ctx, store, repo);
    return restError(ctx, 404, 'Not Found');
  }
  const number = Number(rest[0]);
  if (!Number.isSafeInteger(number) || number <= 0) return restError(ctx, 404, 'Not Found');
  if (rest.length === 1 && method === 'GET') {
    const pull = repo.pulls.get(number);
    if (pull === undefined) return restError(ctx, 404, 'Not Found');
    return restJson(ctx, 200, pullJson(repo, pull));
  }
  if (rest.length === 2 && rest[1] === 'files' && method === 'GET') return listPullFiles(ctx, store, repo, number);
  if (rest.length === 2 && rest[1] === 'merge' && method === 'PUT') return mergePull(ctx, store, repo, number);
  return restError(ctx, 404, 'Not Found');
}

function listPulls(ctx: Ctx, repo: Repo): void {
  const state = ctx.query.get('state') ?? 'open';
  let pulls = [...repo.pulls.values()];
  if (state !== 'all') pulls = pulls.filter((pull) => pull.state === state);
  pulls.sort((a, b) => a.number - b.number);
  const { page, perPage } = pagination(ctx.query);
  const { pageItems } = paginate(pulls, page, perPage);
  return restJson(ctx, 200, pageItems.map((pull) => pullJson(repo, pull)));
}

function createPull(ctx: Ctx, store: Store, repo: Repo): void {
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const head = typeof input.head === 'string' ? input.head : '';
  const base = typeof input.base === 'string' ? input.base : '';
  if (title === '' || head === '' || base === '') return restError(ctx, 422, 'title, head and base are required');
  const headTip = repo.refs.get(`refs/heads/${head}`);
  const baseTip = repo.refs.get(`refs/heads/${base}`);
  if (headTip === undefined || baseTip === undefined) return restError(ctx, 422, 'head or base branch does not exist');
  const number = repo.seq;
  repo.seq += 1;
  const pull: Pull = {
    id: store.nextGlobalId,
    number,
    title,
    body: typeof input.body === 'string' ? input.body : '',
    state: 'open',
    headRef: head,
    baseRef: base,
    baseSha: baseTip,
    merged: false,
    mergedAt: null,
    mergeCommitSha: null,
    createdSeq: number,
  };
  store.nextGlobalId += 1;
  repo.pulls.set(number, pull);
  return restJson(ctx, 201, pullJson(repo, pull));
}

function listPullFiles(ctx: Ctx, store: Store, repo: Repo, number: number): void {
  const pull = repo.pulls.get(number);
  if (pull === undefined) return restError(ctx, 404, 'Not Found');
  const headTip = repo.refs.get(`refs/heads/${pull.headRef}`);
  if (headTip === undefined) return restError(ctx, 404, 'Not Found');
  const headCommit = parseCommit(repo.objects.get(headTip)!.data);
  const baseCommit = parseCommit(repo.objects.get(pull.baseSha)!.data);
  const changes = store.diffTrees(repo, baseCommit.tree, headCommit.tree);
  const headFiles = store.flattenTree(repo, headCommit.tree);
  const baseFiles = store.flattenTree(repo, baseCommit.tree);
  const files = changes.map((change) => {
    const entry = change.status === 'deleted' ? baseFiles.get(change.path) : headFiles.get(change.path);
    const additions = change.status === 'deleted' ? 0 : Math.max(1, change.additions);
    const deletions = change.status === 'added' ? 0 : change.deletions;
    return {
      sha: entry?.oid ?? '',
      filename: change.path,
      status: change.status === 'deleted' ? 'removed' : change.status === 'modified' ? 'modified' : 'added',
      additions,
      deletions,
      changes: additions + deletions,
      blob_url: `https://github.example/${repo.owner}/${repo.name}/blob/${headTip}/${change.path}`,
      raw_url: `https://github.example/${repo.owner}/${repo.name}/raw/${headTip}/${change.path}`,
      contents_url: `/api/v3/repos/${repo.owner}/${repo.name}/contents/${change.path}`,
      patch: '',
    };
  });
  return restJson(ctx, 200, files);
}

function mergePull(ctx: Ctx, store: Store, repo: Repo, number: number): void {
  const pull = repo.pulls.get(number);
  if (pull === undefined) return restError(ctx, 404, 'Not Found');
  if (pull.state === 'closed') return restError(ctx, 405, 'Pull request is already merged or closed');
  let body: unknown;
  try {
    body = parseJsonBody(ctx);
  } catch {
    return restError(ctx, 400, 'Problems parsing JSON');
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const mergeMethod = typeof input.merge_method === 'string' ? input.merge_method : 'squash';
  if (mergeMethod !== 'squash' && mergeMethod !== 'merge' && mergeMethod !== 'rebase') {
    return restError(ctx, 422, 'Invalid merge_method');
  }
  if (store.pullConflicts(repo, pull)) return restError(ctx, 405, 'Merge conflict');
  const mergeOid = store.mergePull(repo, pull);
  if (mergeOid === null) return restError(ctx, 405, 'Merge conflict');
  pull.state = 'closed';
  pull.merged = true;
  pull.mergedAt = MERGED_AT;
  pull.mergeCommitSha = mergeOid;
  return restJson(ctx, 200, { merged: true, sha: mergeOid, message: 'Pull request successfully merged' });
}
