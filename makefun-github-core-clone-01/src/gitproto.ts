// Git smart HTTP: info/refs (v2 + v0 advertisements), upload-pack v2 (ls-refs,
// fetch with shallow support) and receive-pack v0 (push with report-status).
// The wire format follows what the suite's git client parses, section by section.

import {
  decodePktLines,
  encodePktLines,
  parseCommit,
  parseTag,
  pktLine,
  readPack,
  writePack,
  ZERO_OID,
  type GitObject,
} from './gitobj.ts';
import { requireAuth, sendBytes, sendError, type Ctx } from './http.ts';
import { type FetchCacheEntry, type Repo, type Store } from './store.ts';

const UPLOAD_AD = 'application/x-git-upload-pack-advertisement';
const RECEIVE_AD = 'application/x-git-receive-pack-advertisement';
const UPLOAD_RESULT = 'application/x-git-upload-pack-result';
const RECEIVE_RESULT = 'application/x-git-receive-pack-result';

/** The v2 capability advertisement (identical for every repository). Note: unlike
 * v0, the v2 advertisement starts directly with `version 2` — there is no
 * `# service=` line (real git rejects one here; the suite's parser tolerates
 * either form, so this is the correct shape for both). */
const V2_ADVERTISEMENT = (() => {
  const lines: (string | 'flush')[] = [
    'version 2\n',
    'agent=forge/1.0\n',
    'ls-refs=unborn\n',
    'fetch=shallow\n',
    'object-format=sha1\n',
    'flush',
  ];
  return encodePktLines(lines);
})();

function capsText(caps: string[]): string {
  return caps.join(' ');
}

function v0Advertisement(repo: Repo, service: 'git-upload-pack' | 'git-receive-pack'): Buffer {
  const refs = repoRefsForAdvertisement(repo);
  const headTip = repo.refs.get(`refs/heads/${repo.defaultBranch}`);
  const caps =
    service === 'git-upload-pack'
      ? ['symref=HEAD:refs/heads/main', 'side-band-64k', 'thin-pack', 'ofs-delta', 'agent=forge/1.0']
      : ['report-status', 'side-band-64k', 'delete-refs', 'symref=HEAD:refs/heads/main', 'ofs-delta', 'agent=forge/1.0'];
  const lines: (string | Buffer | 'flush')[] = [`# service=${service}\n`, 'flush'];
  if (refs.length === 0) {
    lines.push(`${ZERO_OID} capabilities^{}\0${capsText(caps)}\n`);
  } else {
    // HEAD first, carrying the capabilities after a NUL.
    const headOid = headTip ?? ZERO_OID;
    lines.push(`${headOid} HEAD\0${capsText(caps)}\n`);
    for (const ref of refs) {
      if (ref.name === 'HEAD') continue;
      lines.push(`${ref.oid} ${ref.name}\n`);
      if (ref.peeled !== undefined) lines.push(`${ref.peeled} ${ref.name}^{}\n`);
    }
  }
  lines.push('flush');
  return encodePktLines(lines);
}

interface AdvRef {
  name: string;
  oid: string;
  peeled?: string;
}

function repoRefsForAdvertisement(repo: Repo): AdvRef[] {
  const out: AdvRef[] = [];
  const refs = [...repo.refs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [name, oid] of refs) {
    const entry: AdvRef = { name, oid };
    const object = repo.objects.get(oid);
    if (object !== undefined && object.type === 'tag') {
      entry.peeled = parseTag(object.data).object;
    }
    out.push(entry);
  }
  return out;
}

function lookupRepo(ctx: Ctx, store: Store, owner: string, name: string): Repo | null {
  const repo = store.getRepo(owner, name);
  if (repo === undefined) {
    sendError(ctx, 404, 'Not Found');
    return null;
  }
  return repo;
}

/** GET /<owner>/<repo>.git/info/refs?service=<service> */
export function handleInfoRefs(ctx: Ctx, store: Store, owner: string, repoName: string): void {
  if (requireAuth(ctx) === null) return;
  const service = ctx.query.get('service') ?? '';
  if (service !== 'git-upload-pack' && service !== 'git-receive-pack') {
    sendError(ctx, 400, 'unknown service');
    return;
  }
  const repo = lookupRepo(ctx, store, owner, repoName);
  if (repo === null) return;
  const wantsV2 = service === 'git-upload-pack' && (ctx.req.headers['git-protocol'] ?? '') === 'version=2';
  if (wantsV2) {
    sendBytes(ctx, 200, V2_ADVERTISEMENT, UPLOAD_AD);
    return;
  }
  if (service === 'git-upload-pack') {
    if (repo.advV0Upload === null) repo.advV0Upload = v0Advertisement(repo, service);
    sendBytes(ctx, 200, repo.advV0Upload, UPLOAD_AD);
  } else {
    if (repo.advV0Receive === null) repo.advV0Receive = v0Advertisement(repo, service);
    sendBytes(ctx, 200, repo.advV0Receive, RECEIVE_AD);
  }
}

// ---------------------------------------------------------------------------------------------
// upload-pack v2: ls-refs and fetch
// ---------------------------------------------------------------------------------------------

interface FetchArgs {
  wants: string[];
  haves: string[];
  shallow: string[];
  depth: number | null;
  /** True when the client sent `done` (negotiation complete in this request). */
  done: boolean;
}

function parseFetchArgs(lines: readonly string[]): FetchArgs {
  const args: FetchArgs = { wants: [], haves: [], shallow: [], depth: null, done: false };
  for (const line of lines) {
    const text = line.replace(/\n$/, '');
    if (text === '') continue;
    // The command line and agent/object-format lines precede the delim; the
    // rest are the fetch arguments. (The delim packet itself is not in `lines`.)
    if (text === 'command=fetch' || text.startsWith('agent=') || text.startsWith('object-format=')) continue;
    if (text === 'done') args.done = true;
    else if (text.startsWith('want ')) args.wants.push(text.slice(5).trim());
    else if (text.startsWith('have ')) args.haves.push(text.slice(5).trim());
    else if (text.startsWith('shallow ')) args.shallow.push(text.slice(8).trim());
    else if (text.startsWith('deepen ')) {
      const n = Number(text.slice(7).trim());
      if (Number.isSafeInteger(n) && n >= 0) args.depth = n;
    }
    // thin-pack, no-progress, ofs-delta, filter, deepen-since, deepen-not: ignored.
  }
  return args;
}

interface LsRefsArgs {
  peel: boolean;
  symrefs: boolean;
  unborn: boolean;
  prefixes: string[];
}

function parseLsRefsArgs(lines: readonly string[]): LsRefsArgs {
  const args: LsRefsArgs = { peel: false, symrefs: false, unborn: false, prefixes: [] };
  for (const line of lines) {
    const text = line.replace(/\n$/, '');
    if (text === 'command=ls-refs' || text.startsWith('agent=') || text.startsWith('object-format=')) continue;
    if (text === 'peel') args.peel = true;
    else if (text === 'symrefs') args.symrefs = true;
    else if (text === 'unborn') args.unborn = true;
    else if (text.startsWith('ref-prefix ')) args.prefixes.push(text.slice(11));
  }
  return args;
}

/** Split a decoded pkt-line stream into its data lines, tracking delim boundaries. */
function dataLines(packets: readonly { kind: string; payload: Buffer }[]): string[] {
  const out: string[] = [];
  for (const packet of packets) {
    if (packet.kind === 'data') out.push(packet.payload.toString('utf8'));
  }
  return out;
}

function handleLsRefs(ctx: Ctx, repo: Repo, lines: string[]): void {
  const args = parseLsRefsArgs(lines);
  const refs = repoRefsForAdvertisement(repo);
  const out: (string | 'flush')[] = [];
  const matchesPrefix = (name: string): boolean => args.prefixes.length === 0 || args.prefixes.some((prefix) => name.startsWith(prefix));
  if (refs.length === 0) {
    // Unborn repository: report the unborn HEAD when the client asked for it.
    if (args.unborn) {
      out.push(args.symrefs ? `unborn HEAD symref-target:refs/heads/${repo.defaultBranch}\n` : 'unborn HEAD\n');
    }
  } else {
    // HEAD is listed when no prefix filters it out — including when the client
    // asked for `ref-prefix HEAD` (real git's clone does).
    if (matchesPrefix('HEAD')) {
      const headTip = repo.refs.get(`refs/heads/${repo.defaultBranch}`) ?? ZERO_OID;
      out.push(args.symrefs ? `${headTip} HEAD symref-target:refs/heads/${repo.defaultBranch}\n` : `${headTip} HEAD\n`);
    }
    for (const ref of refs) {
      if (!matchesPrefix(ref.name)) continue;
      let line = `${ref.oid} ${ref.name}`;
      if (args.peel && ref.peeled !== undefined) line += ` peeled:${ref.peeled}`;
      out.push(`${line}\n`);
    }
  }
  out.push('flush');
  sendBytes(ctx, 200, encodePktLines(out), UPLOAD_RESULT);
}

type FetchPlan = FetchCacheEntry;

/** Work out which objects a fetch sends, plus its shallow-info lines. */
function planFetch(store: Store, repo: Repo, args: FetchArgs): FetchPlan {
  const held = store.reachable(repo, args.haves);
  if (args.depth === null) {
    const wanted = store.reachable(repo, args.wants);
    const send: GitObject[] = [];
    for (const oid of wanted) {
      if (held.has(oid)) continue;
      const object = repo.objects.get(oid);
      if (object !== undefined) send.push(object);
    }
    // A full fetch resolves every previous shallow boundary.
    const unshallow = args.shallow.filter((oid) => wanted.has(oid));
    return { pack: writePack(send), shallow: [], unshallow };
  }

  // Shallow fetch: include commits up to `depth` generations from each want.
  const depth = args.depth;
  // A shallow client's `have` only proves it holds that exact object and
  // its tree: its ancestors are NOT held (that is what the shallow boundary
  // means). Using full reachability here would wrongly skip the very
  // parents a deepen fetch must deliver. Tag haves peel to their target
  // commit the same way.
  const heldShallow = new Set<string>();
  for (const have of args.haves) {
    const haveObject = repo.objects.get(have);
    if (haveObject === undefined) continue;
    heldShallow.add(have);
    if (haveObject.type === 'commit') {
      for (const oid of store.reachable(repo, [parseCommit(haveObject.data).tree])) heldShallow.add(oid);
    } else if (haveObject.type === 'tag') {
      const target = parseTag(haveObject.data).object;
      const targetObject = repo.objects.get(target);
      if (targetObject !== undefined && targetObject.type === 'commit') {
        heldShallow.add(target);
        for (const oid of store.reachable(repo, [parseCommit(targetObject.data).tree])) heldShallow.add(oid);
      }
    }
  }
  const commits = new Set<string>();
  const queue: Array<{ oid: string; level: number }> = [];
  for (const want of args.wants) {
    const peeled = peelToCommit(repo, want);
    if (peeled !== null) queue.push({ oid: peeled, level: 1 });
  }
  const commitOrder: string[] = [];
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (commits.has(item.oid)) continue;
    const object = repo.objects.get(item.oid);
    if (object === undefined || object.type !== 'commit') continue;
    commits.add(item.oid);
    commitOrder.push(item.oid);
    if (item.level < depth) {
      for (const parent of parseCommit(object.data).parents) queue.push({ oid: parent, level: item.level + 1 });
    }
  }
  const sendOids = new Set<string>();
  for (const oid of commitOrder) {
    if (heldShallow.has(oid)) continue;
    sendOids.add(oid);
    const commit = parseCommit(repo.objects.get(oid)!.data);
    for (const treeOid of store.reachable(repo, [commit.tree])) {
      if (!heldShallow.has(treeOid)) sendOids.add(treeOid);
    }
  }
  // A want that is a tag (or any non-commit object) travels with its own bytes.
  for (const want of args.wants) {
    if (heldShallow.has(want)) continue;
    const object = repo.objects.get(want);
    if (object !== undefined && object.type !== 'commit') sendOids.add(want);
  }
  const send: GitObject[] = [];
  for (const oid of sendOids) {
    const object = repo.objects.get(oid);
    if (object !== undefined) send.push(object);
  }
  const shallow: string[] = [];
  for (const oid of commitOrder) {
    const object = repo.objects.get(oid)!;
    const parents = parseCommit(object.data).parents;
    if (parents.length > 0 && parents.some((parent) => !commits.has(parent))) shallow.push(oid);
  }
  const unshallow: string[] = [];
  for (const boundary of args.shallow) {
    if (!commits.has(boundary)) continue;
    const object = repo.objects.get(boundary);
    if (object === undefined || object.type !== 'commit') continue;
    const parents = parseCommit(object.data).parents;
    if (parents.every((parent) => commits.has(parent))) unshallow.push(boundary);
  }
  return { pack: writePack(send), shallow, unshallow };
}

function peelToCommit(repo: Repo, oid: string): string | null {
  const object = repo.objects.get(oid);
  if (object === undefined) return null;
  if (object.type === 'commit') return oid;
  if (object.type === 'tag') return parseTag(object.data).object;
  return null;
}

function handleFetch(ctx: Ctx, store: Store, repo: Repo, lines: string[]): void {
  const args = parseFetchArgs(lines);
  if (args.wants.length === 0) {
    // The client never sends this; answer an empty exchange anyway.
    const out = encodePktLines(['acknowledgments\n', 'NAK\n', 'delim', 'flush']);
    sendBytes(ctx, 200, out, UPLOAD_RESULT);
    return;
  }
  const cacheKey = `${repo.version}|${args.wants.join(',')}|${args.haves.join(',')}|${args.depth ?? ''}|${args.shallow.join(',')}`;
  let plan = repo.packCache.get(cacheKey);
  if (plan === undefined) {
    plan = planFetch(store, repo, args);
    repo.packCache.set(cacheKey, plan);
  }
  const parts: Buffer[] = [];
  // The acknowledgments section exists only while the client is still
  // negotiating: it sent `have` lines but no `done`. A request that carries
  // `done` (every smart-HTTP fetch in practice) gets no such section — real
  // git rejects one there, and the suite's parser accepts its absence.
  if (args.haves.length > 0 && !args.done) {
    parts.push(pktLine('acknowledgments\n'));
    let acked = 0;
    for (const have of args.haves) {
      if (repo.objects.has(have)) {
        parts.push(pktLine(`ACK ${have}\n`));
        acked += 1;
      }
    }
    if (acked === 0) parts.push(pktLine('NAK\n'));
    else parts.push(pktLine('ready\n'));
    parts.push(pktLine('delim'));
  }
  if (plan.shallow.length > 0 || plan.unshallow.length > 0) {
    parts.push(pktLine('shallow-info\n'));
    for (const oid of plan.shallow) parts.push(pktLine(`shallow ${oid}\n`));
    for (const oid of plan.unshallow) parts.push(pktLine(`unshallow ${oid}\n`));
    parts.push(pktLine('delim'));
  }
  parts.push(pktLine('packfile\n'));
  // NOTE: no delim after 'packfile' — the suite's parser reads sideband packets
  // directly after the section name.
  const pack = plan.pack;
  const CHUNK = 65515;
  for (let offset = 0; offset < pack.length; offset += CHUNK) {
    const slice = pack.subarray(offset, Math.min(pack.length, offset + CHUNK));
    parts.push(pktLine(Buffer.concat([Buffer.from([1]), slice])));
  }
  parts.push(pktLine('flush'));
  sendBytes(ctx, 200, Buffer.concat(parts), UPLOAD_RESULT);
}

/** POST /<owner>/<repo>.git/git-upload-pack */
export function handleUploadPack(ctx: Ctx, store: Store, owner: string, repoName: string): void {
  if (requireAuth(ctx) === null) return;
  const repo = lookupRepo(ctx, store, owner, repoName);
  if (repo === null) return;
  if (ctx.body === null || ctx.body.length === 0) {
    sendError(ctx, 400, 'empty request');
    return;
  }
  let packets;
  try {
    packets = decodePktLines(ctx.body);
  } catch {
    sendError(ctx, 400, 'malformed pkt-line');
    return;
  }
  const lines = dataLines(packets);
  const first = lines[0] ?? '';
  if (first.startsWith('command=ls-refs')) {
    handleLsRefs(ctx, repo, lines);
    return;
  }
  if (first.startsWith('command=fetch')) {
    handleFetch(ctx, store, repo, lines);
    return;
  }
  sendError(ctx, 400, 'unknown command');
}

// ---------------------------------------------------------------------------------------------
// receive-pack v0: push
// ---------------------------------------------------------------------------------------------

interface PushCommand {
  oldOid: string;
  newOid: string;
  ref: string;
}

interface PushResult {
  ref: string;
  ok: boolean;
  reason: string;
}

/** Read pkt-lines one by one until the flush; returns the lines and the offset past it. */
function readCommandLines(buf: Buffer): { lines: string[]; offset: number } {
  const lines: string[] = [];
  let offset = 0;
  for (;;) {
    if (offset + 4 > buf.length) throw new Error('command list truncated');
    const lenText = buf.subarray(offset, offset + 4).toString('ascii');
    const len = parseInt(lenText, 16);
    if (Number.isNaN(len)) throw new Error('bad pkt-line length in command list');
    if (len === 0) {
      offset += 4;
      break;
    }
    if (len < 4 || offset + len > buf.length) throw new Error('command line out of range');
    lines.push(buf.subarray(offset + 4, offset + len).toString('utf8'));
    offset += len;
  }
  return { lines, offset };
}

/** POST /<owner>/<repo>.git/git-receive-pack */
export function handleReceivePack(ctx: Ctx, store: Store, owner: string, repoName: string): void {
  if (requireAuth(ctx) === null) return;
  const repo = lookupRepo(ctx, store, owner, repoName);
  if (repo === null) return;
  if (ctx.body === null || ctx.body.length === 0) {
    sendError(ctx, 400, 'empty request');
    return;
  }
  let commands: PushCommand[] = [];
  let packBytes: Buffer | null = null;
  let requestCaps = '';
  let unpackError: string | null = null;
  try {
    const { lines, offset } = readCommandLines(ctx.body);
    commands = lines.map((rawLine, index) => {
      let line = rawLine.replace(/\n$/, '');
      if (index === 0) {
        const nul = line.indexOf('\0');
        if (nul >= 0) {
          requestCaps = line.slice(nul + 1);
          line = line.slice(0, nul);
        }
      }
      const parts = line.split(' ');
      if (parts.length < 3) throw new Error('bad push command');
      return { oldOid: parts[0]!, newOid: parts[1]!, ref: parts[2]! };
    });
    if (offset < ctx.body.length) packBytes = ctx.body.subarray(offset);
  } catch (err) {
    unpackError = (err as Error).message;
  }

  const results: PushResult[] = [];
  let anyRefChanged = false;
  if (unpackError === null && commands.length > 0) {
    // Unpack first: every object lands in the store even for refused refs.
    if (packBytes !== null && packBytes.length > 0) {
      try {
        const { objects } = readPack(packBytes, (oid) => repo.objects.get(oid));
        for (const [oid, object] of objects) {
          if (!repo.objects.has(oid)) repo.objects.set(oid, object);
        }
      } catch (err) {
        unpackError = (err as Error).message;
      }
    }
  }
  if (unpackError === null) {
    for (const command of commands) {
      const result = applyPushCommand(store, repo, command);
      results.push(result);
      if (result.ok) anyRefChanged = true;
    }
  } else {
    for (const command of commands) results.push({ ref: command.ref, ok: false, reason: 'unpack error' });
  }
  if (anyRefChanged) store.touch(repo);

  const reportLines: string[] = [];
  reportLines.push(unpackError === null ? 'unpack ok\n' : `unpack ${unpackError}\n`);
  for (const result of results) {
    reportLines.push(result.ok ? `ok ${result.ref}\n` : `ng ${result.ref} ${result.reason}\n`);
  }
  const sideband = requestCaps.split(' ').includes('side-band-64k');
  let body: Buffer;
  if (sideband) {
    const inner = encodePktLines([...reportLines, 'flush']);
    body = Buffer.concat([pktLine(Buffer.concat([Buffer.from([1]), inner])), pktLine('flush')]);
  } else {
    body = encodePktLines([...reportLines, 'flush']);
  }
  sendBytes(ctx, 200, body, RECEIVE_RESULT);
}

function applyPushCommand(store: Store, repo: Repo, command: PushCommand): PushResult {
  const { oldOid, newOid, ref } = command;
  const current = repo.refs.get(ref);
  if (newOid === ZERO_OID) {
    // Delete.
    if (current === undefined) return { ref, ok: false, reason: 'remote ref does not exist' };
    if (current !== oldOid) return { ref, ok: false, reason: 'old oid mismatch' };
    repo.refs.delete(ref);
    return { ref, ok: true, reason: '' };
  }
  if (oldOid === ZERO_OID) {
    // Create.
    if (current !== undefined) return { ref, ok: false, reason: 'already exists' };
    if (!repo.objects.has(newOid)) return { ref, ok: false, reason: 'object not found' };
    repo.refs.set(ref, newOid);
    return { ref, ok: true, reason: '' };
  }
  // Update.
  if (current === undefined) return { ref, ok: false, reason: 'remote ref does not exist' };
  if (current !== oldOid) return { ref, ok: false, reason: 'old oid mismatch' };
  if (!repo.objects.has(newOid)) return { ref, ok: false, reason: 'object not found' };
  if (!store.isAncestor(repo, oldOid, newOid)) return { ref, ok: false, reason: 'non-fast-forward' };
  repo.refs.set(ref, newOid);
  return { ref, ok: true, reason: '' };
}
