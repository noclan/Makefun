// The forge's in-memory store: users, repositories, git objects and refs, issues,
// labels, comments and pull requests. One Store per process; everything is plain
// data, deterministic, no wall clock (commit timestamps use a fixed base + counter).

import {
  buildCommitBytes,
  buildTree,
  hashObject,
  parseCommit,
  parseTag,
  parseTree,
  treeSortKey,
  ZERO_OID,
  type GitObject,
  type GitObjectType,
  type TreeEntry,
} from './gitobj.ts';

/** The scenario's viewer: the token owner. Fixed by the kit's seeded scenario. */
export const VIEWER_LOGIN = 'adaiversen';
export const VIEWER_ID = 1000;
export const VIEWER_NAME = 'ada iversen';
export const VIEWER_EMAIL = 'adaiversen@example.invalid';
export const STRANGER_LOGIN = 'olgabauer';
export const TEAMMATE_LOGIN = 'quinnkeller';

/** Fixed base for timestamps this forge writes (deterministic, never wall clock). */
export const FORGE_EPOCH_SEC = 1700000000;
export const MERGED_AT = '2025-01-01T00:00:00.000Z';

/** One cached fetch plan: the pack bytes plus its shallow-info lines. */
export interface FetchCacheEntry {
  pack: Buffer;
  shallow: string[];
  unshallow: string[];
}

export function viewerIdentity(epochSec: number): string {
  return `${VIEWER_NAME} <${VIEWER_EMAIL}> ${epochSec} +0000`;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  createdSeq: number;
}

export interface Pull {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  headRef: string;
  baseRef: string;
  /** The base branch tip when the PR was created (the merge base for files/conflicts). */
  baseSha: string;
  merged: boolean;
  mergedAt: string | null;
  mergeCommitSha: string | null;
  createdSeq: number;
}

export interface Comment {
  id: number;
  body: string;
}

export interface Repo {
  id: number;
  owner: string;
  name: string;
  description: string;
  private: boolean;
  defaultBranch: string;
  objects: Map<string, GitObject>;
  refs: Map<string, string>;
  issues: Map<number, Issue>;
  pulls: Map<number, Pull>;
  labels: Map<string, { name: string; color: string }>;
  comments: Map<number, Comment[]>;
  /** Shared issue+pull-request number sequence (GitHub numbers them together). */
  seq: number;
  commentSeq: number;
  createdOrder: number;
  /** Bumped on every ref/object change; caches key off it. */
  version: number;
  /** Fetch-plan cache: key -> {pack, shallow, unshallow}. Cleared on touch. */
  packCache: Map<string, FetchCacheEntry>;
  /** Cached v0 advertisement body for this version (null when not built). */
  advV0Upload: Buffer | null;
  advV0Receive: Buffer | null;
}

export class Store {
  repos = new Map<string, Repo>();
  nextRepoId = 1;
  nextGlobalId = 1;
  nextRepoOrder = 1;
  nextCommentId = 1;
  commitCounter = 0;

  key(owner: string, name: string): string {
    return `${owner}/${name}`;
  }

  getRepo(owner: string, name: string): Repo | undefined {
    return this.repos.get(this.key(owner, name));
  }

  createRepo(owner: string, name: string, input: { description?: string; private?: boolean }): Repo {
    const repo: Repo = {
      id: this.nextRepoId++,
      owner,
      name,
      description: input.description ?? '',
      private: input.private ?? false,
      defaultBranch: 'main',
      objects: new Map(),
      refs: new Map(),
      issues: new Map(),
      pulls: new Map(),
      labels: new Map(),
      comments: new Map(),
      seq: 1,
      commentSeq: 1,
      createdOrder: this.nextRepoOrder++,
      version: 0,
      packCache: new Map(),
      advV0Upload: null,
      advV0Receive: null,
    };
    this.repos.set(this.key(owner, name), repo);
    return repo;
  }

  deleteRepo(owner: string, name: string): boolean {
    return this.repos.delete(this.key(owner, name));
  }

  /** Every repo of one owner, in creation order. */
  reposOf(owner: string): Repo[] {
    const out: Repo[] = [];
    for (const repo of this.repos.values()) if (repo.owner === owner) out.push(repo);
    out.sort((a, b) => a.createdOrder - b.createdOrder);
    return out;
  }

  /** Bump a repo's version and drop its derived caches. */
  touch(repo: Repo): void {
    repo.version += 1;
    repo.packCache.clear();
    repo.advV0Upload = null;
    repo.advV0Receive = null;
  }

  /** A fresh deterministic commit timestamp (fixed base + monotonic counter). */
  nextEpoch(): number {
    this.commitCounter += 1;
    return FORGE_EPOCH_SEC + this.commitCounter;
  }

  // -------------------------------------------------------------------------------------------
  // global ids (Relay): opaque base64 of a typed path, stable across reads
  // -------------------------------------------------------------------------------------------

  repoGlobalId(repo: Repo): string {
    return Buffer.from(`repo:${repo.owner}/${repo.name}`, 'utf8').toString('base64');
  }

  issueGlobalId(repo: Repo, number: number): string {
    return Buffer.from(`issue:${repo.owner}/${repo.name}:${number}`, 'utf8').toString('base64');
  }

  pullGlobalId(repo: Repo, number: number): string {
    return Buffer.from(`pr:${repo.owner}/${repo.name}:${number}`, 'utf8').toString('base64');
  }

  commentGlobalId(repo: Repo, issueNumber: number, commentId: number): string {
    return Buffer.from(`comment:${repo.owner}/${repo.name}:${issueNumber}:${commentId}`, 'utf8').toString('base64');
  }

  /** Decode a global id into its parts, or null when it is not one of ours. */
  decodeGlobalId(id: string): { kind: string; owner: string; name: string; number: number; extra: number } | null {
    let text: string;
    try {
      text = Buffer.from(id, 'base64').toString('utf8');
    } catch {
      return null;
    }
    const parts = text.split(':');
    if (parts.length < 2) return null;
    const kind = parts[0] ?? '';
    const ownerName = parts[1] ?? '';
    const slash = ownerName.indexOf('/');
    if (slash < 0) return null;
    const owner = ownerName.slice(0, slash);
    const name = ownerName.slice(slash + 1);
    // A repository id carries only two colon-separated parts ("repo:owner/name"),
    // so it is answered here before the three-part check below.
    if (kind === 'repo') return { kind, owner, name, number: 0, extra: 0 };
    if (parts.length < 3) return null;
    const number = Number(parts[2]);
    if (!Number.isSafeInteger(number)) return null;
    const extra = parts.length > 3 ? Number(parts[3]) : 0;
    return { kind, owner, name, number, extra };
  }

  resolveGlobalId(id: string): { repo: Repo; kind: string; number: number; extra: number } | null {
    const decoded = this.decodeGlobalId(id);
    if (decoded === null) return null;
    const repo = this.getRepo(decoded.owner, decoded.name);
    if (repo === undefined) return null;
    return { repo, kind: decoded.kind, number: decoded.number, extra: decoded.extra };
  }

  // -------------------------------------------------------------------------------------------
  // git objects and refs
  // -------------------------------------------------------------------------------------------

  putObject(repo: Repo, type: GitObjectType, data: Buffer): string {
    const oid = hashObject(type, data);
    if (!repo.objects.has(oid)) repo.objects.set(oid, { type, data });
    return oid;
  }

  getObject(repo: Repo, oid: string): GitObject | undefined {
    return repo.objects.get(oid);
  }

  refTip(repo: Repo, ref: string): string | undefined {
    return repo.refs.get(ref);
  }

  setRef(repo: Repo, ref: string, oid: string): void {
    repo.refs.set(ref, oid);
  }

  deleteRef(repo: Repo, ref: string): boolean {
    return repo.refs.delete(ref);
  }

  /** The refs a clone advertises, in a stable order (heads, then tags, by name). */
  advertisedRefs(repo: Repo): Array<{ name: string; oid: string }> {
    const out: Array<{ name: string; oid: string }> = [];
    for (const [name, oid] of repo.refs) out.push({ name, oid });
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
  }

  /** The oid a tag object peels to (its commit), or null when the ref is not an annotated tag. */
  peeledOid(repo: Repo, oid: string): string | null {
    const object = repo.objects.get(oid);
    if (object === undefined || object.type !== 'tag') return null;
    const tag = parseTag(object.data);
    return tag.object;
  }

  /** Every object reachable from the given tips (commits, trees, blobs, tags). */
  reachable(repo: Repo, tips: Iterable<string>): Set<string> {
    const seen = new Set<string>();
    const stack: string[] = [...tips];
    while (stack.length > 0) {
      const oid = stack.pop()!;
      if (oid === ZERO_OID || seen.has(oid)) continue;
      const object = repo.objects.get(oid);
      if (object === undefined) continue;
      seen.add(oid);
      if (object.type === 'commit') {
        const commit = parseCommit(object.data);
        stack.push(commit.tree);
        for (const parent of commit.parents) stack.push(parent);
      } else if (object.type === 'tree') {
        for (const entry of parseTree(object.data)) stack.push(entry.oid);
      } else if (object.type === 'tag') {
        stack.push(parseTag(object.data).object);
      }
    }
    return seen;
  }

  /** True when `ancestor` is reachable from `tip` through commit parents (or equal). */
  isAncestor(repo: Repo, ancestor: string, tip: string): boolean {
    if (ancestor === tip) return true;
    const seen = new Set<string>();
    const stack = [tip];
    while (stack.length > 0) {
      const oid = stack.pop()!;
      if (oid === ZERO_OID || seen.has(oid)) continue;
      seen.add(oid);
      const object = repo.objects.get(oid);
      if (object === undefined || object.type !== 'commit') continue;
      for (const parent of parseCommit(object.data).parents) {
        if (parent === ancestor) return true;
        stack.push(parent);
      }
    }
    return false;
  }

  /** The commit oids reachable from `tip` through parents, newest first (creation order). */
  commitHistory(repo: Repo, tip: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const stack = [tip];
    while (stack.length > 0) {
      const oid = stack.pop()!;
      if (oid === ZERO_OID || seen.has(oid)) continue;
      const object = repo.objects.get(oid);
      if (object === undefined || object.type !== 'commit') continue;
      seen.add(oid);
      out.push(oid);
      const parents = parseCommit(object.data).parents;
      for (let i = parents.length - 1; i >= 0; i -= 1) stack.push(parents[i]!);
    }
    return out;
  }

  // -------------------------------------------------------------------------------------------
  // trees: path maps, building, diffing
  // -------------------------------------------------------------------------------------------

  /** Flatten a tree into path -> {oid, mode}, recursively. */
  flattenTree(repo: Repo, treeOid: string, prefix = ''): Map<string, { oid: string; mode: string }> {
    const out = new Map<string, { oid: string; mode: string }>();
    const walk = (oid: string, path: string): void => {
      const object = repo.objects.get(oid);
      if (object === undefined || object.type !== 'tree') return;
      for (const entry of parseTree(object.data)) {
        const full = path === '' ? entry.name : `${path}/${entry.name}`;
        if (entry.mode === '40000') walk(entry.oid, full);
        else out.set(full, { oid: entry.oid, mode: entry.mode });
      }
    };
    walk(treeOid, prefix);
    return out;
  }

  /**
   * Build (and store) the tree for a path map, bottom-up. Returns the root tree oid.
   * Directories are created as needed; entries are git-sorted.
   */
  buildTreeForPaths(repo: Repo, files: Map<string, { oid: string; mode: string }>): string {
    const buildLevelFromMap = (map: Map<string, { oid: string; mode: string }>): string => {
      // Re-key the map for this level: buildLevel expects paths relative to the level.
      const paths = [...map.keys()];
      const entries: TreeEntry[] = [];
      const dirs = new Map<string, string[]>();
      const direct: string[] = [];
      for (const path of paths) {
        const slash = path.indexOf('/');
        if (slash < 0) direct.push(path);
        else {
          const dir = path.slice(0, slash);
          const rest = path.slice(slash + 1);
          const list = dirs.get(dir) ?? [];
          list.push(rest);
          dirs.set(dir, list);
        }
      }
      for (const path of direct) {
        const file = map.get(path)!;
        entries.push({ mode: file.mode, name: path, oid: file.oid });
      }
      for (const [dir, rest] of dirs) {
        const sub = new Map<string, { oid: string; mode: string }>();
        for (const path of rest) sub.set(path, map.get(`${dir}/${path}`)!);
        const subOid = buildLevelFromMap(sub);
        entries.push({ mode: '40000', name: dir, oid: subOid });
      }
      entries.sort((a, b) => (treeSortKey(a) < treeSortKey(b) ? -1 : treeSortKey(a) > treeSortKey(b) ? 1 : 0));
      return this.putObject(repo, 'tree', buildTree(entries));
    };
    return buildLevelFromMap(files);
  }

  /**
   * Create a commit on `branch` (creating the branch from the default tip when it does not
   * exist yet) that sets `path` to `content` (or deletes it when content is null). The
   * commit's parent is the branch tip (or the default tip for a new branch). Returns the
   * new commit oid and the blob oid (null on delete).
   */
  commitFile(
    repo: Repo,
    branch: string,
    path: string,
    content: Buffer | null,
    message: string,
  ): { commitOid: string; blobOid: string | null } {
    const branchRef = `refs/heads/${branch}`;
    let parent = repo.refs.get(branchRef);
    let baseFiles = new Map<string, { oid: string; mode: string }>();
    if (parent === undefined) {
      // New branch: fork from the default branch tip (or start empty).
      const defaultTip = repo.refs.get(`refs/heads/${repo.defaultBranch}`);
      if (defaultTip !== undefined) {
        parent = defaultTip;
        const commit = parseCommit(repo.objects.get(defaultTip)!.data);
        baseFiles = this.flattenTree(repo, commit.tree);
      }
    } else {
      const commit = parseCommit(repo.objects.get(parent)!.data);
      baseFiles = this.flattenTree(repo, commit.tree);
    }
    let blobOid: string | null = null;
    if (content === null) {
      baseFiles.delete(path);
    } else {
      blobOid = this.putObject(repo, 'blob', content);
      baseFiles.set(path, { oid: blobOid, mode: '100644' });
    }
    const treeOid = this.buildTreeForPaths(repo, baseFiles);
    const epoch = this.nextEpoch();
    const identity = viewerIdentity(epoch);
    const commitData = buildCommitBytes({
      tree: treeOid,
      parents: parent === undefined ? [] : [parent],
      author: identity,
      committer: identity,
      message,
    });
    const commitOid = this.putObject(repo, 'commit', commitData);
    repo.refs.set(branchRef, commitOid);
    this.touch(repo);
    return { commitOid, blobOid };
  }

  /**
   * The file changes between two trees: {path, status, additions, deletions} where status is
   * 'added' | 'modified' | 'deleted'. additions/deletions are line counts for text blobs
   * (0 when uncountable); callers that need >=1 additions for a changed file use the line
   * diff of the two blobs.
   */
  diffTrees(repo: Repo, baseTreeOid: string | null, headTreeOid: string): Array<{ path: string; status: 'added' | 'modified' | 'deleted'; additions: number; deletions: number }> {
    const base = baseTreeOid === null ? new Map() : this.flattenTree(repo, baseTreeOid);
    const head = this.flattenTree(repo, headTreeOid);
    const out: Array<{ path: string; status: 'added' | 'modified' | 'deleted'; additions: number; deletions: number }> = [];
    const paths = new Set([...base.keys(), ...head.keys()]);
    for (const path of [...paths].sort()) {
      const b = base.get(path);
      const h = head.get(path);
      if (b === undefined && h !== undefined) {
        const lines = countLines(repo, h.oid);
        out.push({ path, status: 'added', additions: lines, deletions: 0 });
      } else if (b !== undefined && h === undefined) {
        const lines = countLines(repo, b.oid);
        out.push({ path, status: 'deleted', additions: 0, deletions: lines });
      } else if (b !== undefined && h !== undefined && b.oid !== h.oid) {
        const [additions, deletions] = diffLines(repo, b.oid, h.oid);
        out.push({ path, status: 'modified', additions, deletions });
      }
    }
    return out;
  }

  /** True when merging `pull` would conflict: a file it changes differs on the base tip. */
  pullConflicts(repo: Repo, pull: Pull): boolean {
    const headTip = repo.refs.get(`refs/heads/${pull.headRef}`);
    const baseTip = repo.refs.get(`refs/heads/${pull.baseRef}`);
    if (headTip === undefined || baseTip === undefined) return true;
    const headCommit = parseCommit(repo.objects.get(headTip)!.data);
    const baseAtCreation = repo.objects.get(pull.baseSha);
    if (baseAtCreation === undefined) return true;
    const baseCommit = parseCommit(baseAtCreation.data);
    const changes = this.diffTrees(repo, baseCommit.tree, headCommit.tree);
    const baseNowCommit = parseCommit(repo.objects.get(baseTip)!.data);
    const baseNow = this.flattenTree(repo, baseNowCommit.tree);
    const baseThen = this.flattenTree(repo, baseCommit.tree);
    for (const change of changes) {
      const thenEntry = baseThen.get(change.path);
      const nowEntry = baseNow.get(change.path);
      const thenOid = thenEntry?.oid ?? null;
      const nowOid = nowEntry?.oid ?? null;
      if (thenOid !== nowOid) return true;
    }
    return false;
  }

  /**
   * Squash-merge a pull request onto its base branch. Returns the merge commit oid, or null
   * when the PR conflicts. The merge commit's tree is the base tree plus the PR's changes.
   */
  mergePull(repo: Repo, pull: Pull): string | null {
    if (this.pullConflicts(repo, pull)) return null;
    const headTip = repo.refs.get(`refs/heads/${pull.headRef}`)!;
    const baseTip = repo.refs.get(`refs/heads/${pull.baseRef}`)!;
    const headCommit = parseCommit(repo.objects.get(headTip)!.data);
    const baseCommit = parseCommit(repo.objects.get(pull.baseSha)!.data);
    const baseNowCommit = parseCommit(repo.objects.get(baseTip)!.data);
    const changes = this.diffTrees(repo, baseCommit.tree, headCommit.tree);
    const baseNow = this.flattenTree(repo, baseNowCommit.tree);
    const headFiles = this.flattenTree(repo, headCommit.tree);
    for (const change of changes) {
      if (change.status === 'deleted') baseNow.delete(change.path);
      else {
        const entry = headFiles.get(change.path);
        if (entry !== undefined) baseNow.set(change.path, entry);
      }
    }
    const treeOid = this.buildTreeForPaths(repo, baseNow);
    const epoch = this.nextEpoch();
    const identity = viewerIdentity(epoch);
    const message = `Merge pull request #${pull.number} from ${repo.owner}/${pull.headRef}`;
    const commitData = buildCommitBytes({
      tree: treeOid,
      parents: [baseTip],
      author: identity,
      committer: identity,
      message,
    });
    const mergeOid = this.putObject(repo, 'commit', commitData);
    repo.refs.set(`refs/heads/${pull.baseRef}`, mergeOid);
    this.touch(repo);
    return mergeOid;
  }
}

/** Line count of a blob (0 when missing or binary). */
export function countLines(repo: Repo, oid: string): number {
  const object = repo.objects.get(oid);
  if (object === undefined || object.type !== 'blob') return 0;
  const text = object.data.toString('utf8');
  if (text.includes('\0')) return 0;
  if (text === '') return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

/** [additions, deletions] between two blobs, by line-set comparison. */
export function diffLines(repo: Repo, baseOid: string, headOid: string): [number, number] {
  const base = repo.objects.get(baseOid);
  const head = repo.objects.get(headOid);
  if (base === undefined || head === undefined) return [1, 0];
  const baseText = base.data.toString('utf8');
  const headText = head.data.toString('utf8');
  if (baseText.includes('\0') || headText.includes('\0')) return [1, 1];
  const baseLines = baseText === '' ? [] : baseText.split('\n');
  const headLines = headText === '' ? [] : headText.split('\n');
  const baseSet = new Map<string, number>();
  for (const line of baseLines) baseSet.set(line, (baseSet.get(line) ?? 0) + 1);
  const headSet = new Map<string, number>();
  for (const line of headLines) headSet.set(line, (headSet.get(line) ?? 0) + 1);
  let additions = 0;
  let deletions = 0;
  for (const [line, count] of headSet) {
    const inBase = baseSet.get(line) ?? 0;
    if (count > inBase) additions += count - inBase;
  }
  for (const [line, count] of baseSet) {
    const inHead = headSet.get(line) ?? 0;
    if (count > inHead) deletions += count - inHead;
  }
  if (additions === 0 && deletions === 0 && baseText !== headText) return [1, 1];
  return [additions, deletions];
}
