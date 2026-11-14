// GraphQL: a small recursive-descent parser for the document subset the suite's
// clients send, plus an executor over the forge's store. Supports variables,
// aliases, fragments, inline fragments, @include/@skip, introspection (__type,
// __schema) and operation batching (a JSON array of operations in one body).
// PullRequest.mergeable answers the MergeableState enum; Commit.message trims a trailing newline.

import { parseCommit } from './gitobj.ts';
import { requireAuth, sendJson, type Ctx } from './http.ts';
import {
  MERGED_AT,
  VIEWER_EMAIL,
  VIEWER_ID,
  VIEWER_NAME,
  type Issue,
  type Pull,
  type Repo,
  type Store,
} from './store.ts';

// ---------------------------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------------------------

type Token =
  | { kind: 'Name'; value: string }
  | { kind: 'Int'; value: string }
  | { kind: 'Float'; value: string }
  | { kind: 'String'; value: string }
  | { kind: 'Punct'; value: string }
  | { kind: 'EOF' };

const PUNCT = new Set(['!', '$', '&', '(', ')', ':', '=', '@', '[', ']', '{', '|', '}']);

function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',') {
      i += 1;
      continue;
    }
    if (ch === '#') {
      while (i < n && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '.' && source.slice(i, i + 3) === '...') {
      tokens.push({ kind: 'Punct', value: '...' });
      i += 3;
      continue;
    }
    if (PUNCT.has(ch)) {
      tokens.push({ kind: 'Punct', value: ch });
      i += 1;
      continue;
    }
    if (ch === '"') {
      if (source.slice(i, i + 3) === '"""') {
        const end = source.indexOf('"""', i + 3);
        if (end < 0) throw new Error('unterminated block string');
        tokens.push({ kind: 'String', value: source.slice(i + 3, end).replace(/\\"""/g, '"""') });
        i = end + 3;
        continue;
      }
      let j = i + 1;
      let out = '';
      for (;;) {
        if (j >= n) throw new Error('unterminated string');
        const c = source[j]!;
        if (c === '"') break;
        if (c === '\\') {
          const esc = source[j + 1];
          if (esc === undefined) throw new Error('unterminated string');
          const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
          if (esc === 'u') {
            out += String.fromCharCode(parseInt(source.slice(j + 2, j + 6), 16));
            j += 6;
          } else {
            out += map[esc] ?? esc;
            j += 2;
          }
          continue;
        }
        out += c;
        j += 1;
      }
      tokens.push({ kind: 'String', value: out });
      i = j + 1;
      continue;
    }
    if (/[0-9-]/.test(ch)) {
      let j = i;
      if (source[j] === '-') j += 1;
      while (j < n && /[0-9]/.test(source[j]!)) j += 1;
      let isFloat = false;
      if (source[j] === '.') {
        isFloat = true;
        j += 1;
        while (j < n && /[0-9]/.test(source[j]!)) j += 1;
      }
      if (source[j] === 'e' || source[j] === 'E') {
        isFloat = true;
        j += 1;
        if (source[j] === '+' || source[j] === '-') j += 1;
        while (j < n && /[0-9]/.test(source[j]!)) j += 1;
      }
      tokens.push({ kind: isFloat ? 'Float' : 'Int', value: source.slice(i, j) });
      i = j;
      continue;
    }
    if (/[_A-Za-z]/.test(ch)) {
      let j = i;
      while (j < n && /[_A-Za-z0-9]/.test(source[j]!)) j += 1;
      tokens.push({ kind: 'Name', value: source.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`unexpected character ${JSON.stringify(ch)}`);
  }
  tokens.push({ kind: 'EOF' });
  return tokens;
}

// ---------------------------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------------------------

export type Value =
  | { kind: 'Variable'; name: string }
  | { kind: 'String'; value: string }
  | { kind: 'Int'; value: number }
  | { kind: 'Float'; value: number }
  | { kind: 'Boolean'; value: boolean }
  | { kind: 'Null' }
  | { kind: 'Enum'; value: string }
  | { kind: 'List'; values: Value[] }
  | { kind: 'Object'; fields: Array<{ name: string; value: Value }> };

export interface Directive {
  name: string;
  args: Array<{ name: string; value: Value }>;
}

export type Selection =
  | { kind: 'Field'; name: string; alias: string | null; args: Array<{ name: string; value: Value }>; directives: Directive[]; selections: Selection[] | null }
  | { kind: 'FragmentSpread'; name: string; directives: Directive[] }
  | { kind: 'InlineFragment'; typeCondition: string | null; directives: Directive[]; selections: Selection[] };

export interface Operation {
  kind: 'query' | 'mutation' | 'subscription';
  name: string | null;
  selections: Selection[];
}

export interface Fragment {
  name: string;
  typeCondition: string;
  selections: Selection[];
}

export interface Document {
  operations: Operation[];
  fragments: Map<string, Fragment>;
}

function describeToken(token: Token): string {
  return 'value' in token ? `${token.kind} ${token.value}` : token.kind;
}

class Parser {
  private pos = 0;
  private readonly tokens: Token[];
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    const token = this.tokens[this.pos]!;
    this.pos += 1;
    return token;
  }

  private expectPunct(value: string): void {
    const token = this.next();
    if (token.kind !== 'Punct' || token.value !== value) throw new Error(`expected ${value}, got ${describeToken(token)}`);
  }

  private expectName(value?: string): string {
    const token = this.next();
    if (token.kind !== 'Name') throw new Error(`expected a name, got ${describeToken(token)}`);
    if (value !== undefined && token.value !== value) throw new Error(`expected ${value}, got ${token.value}`);
    return token.value;
  }

  parseDocument(): Document {
    const operations: Operation[] = [];
    const fragments = new Map<string, Fragment>();
    for (;;) {
      const token = this.peek();
      if (token.kind === 'EOF') break;
      if (token.kind === 'Punct' && token.value === '{') {
        operations.push({ kind: 'query', name: null, selections: this.parseSelectionSet() });
        continue;
      }
      if (token.kind === 'Name' && token.value === 'fragment') {
        this.next();
        const name = this.expectName();
        this.expectName('on');
        const typeCondition = this.expectName();
        const selections = this.parseSelectionSet();
        fragments.set(name, { name, typeCondition, selections });
        continue;
      }
      if (token.kind === 'Name' && (token.value === 'query' || token.value === 'mutation' || token.value === 'subscription')) {
        const kind = token.value as Operation['kind'];
        this.next();
        let name: string | null = null;
        const nameToken = this.peek();
        if (nameToken.kind === 'Name') {
          this.next();
          name = nameToken.value;
        }
        // Variable definitions: ($x: Type = default, ...) — skip their tokens.
        const varToken = this.peek();
        if (varToken.kind === 'Punct' && varToken.value === '(') this.skipVariableDefinitions();
        const selections = this.parseSelectionSet();
        operations.push({ kind, name, selections });
        continue;
      }
      throw new Error(`unexpected token ${describeToken(token)}`);
    }
    return { operations, fragments };
  }

  /** Skip a parenthesised variable-definition list, tracking nesting. */
  private skipVariableDefinitions(): void {
    let depth = 0;
    for (;;) {
      const token = this.next();
      if (token.kind === 'Punct' && token.value === '(') depth += 1;
      else if (token.kind === 'Punct' && token.value === ')') {
        depth -= 1;
        if (depth === 0) return;
      } else if (token.kind === 'EOF') throw new Error('unterminated variable definitions');
    }
  }

  private parseSelectionSet(): Selection[] {
    this.expectPunct('{');
    const selections: Selection[] = [];
    for (;;) {
      const token = this.peek();
      if (token.kind === 'Punct' && token.value === '}') {
        this.next();
        return selections;
      }
      if (token.kind === 'EOF') throw new Error('unterminated selection set');
      selections.push(this.parseSelection());
    }
  }

  private parseSelection(): Selection {
    const token = this.peek();
    if (token.kind === 'Punct' && token.value === '...') {
      this.next();
      const nextToken = this.peek();
      if (nextToken.kind === 'Name' && nextToken.value !== 'on') {
        this.next();
        const name = nextToken.value;
        const directives = this.parseDirectives();
        return { kind: 'FragmentSpread', name, directives };
      }
      let typeCondition: string | null = null;
      if (nextToken.kind === 'Name' && nextToken.value === 'on') {
        this.next();
        typeCondition = this.expectName();
      }
      const directives = this.parseDirectives();
      const selections = this.parseSelectionSet();
      return { kind: 'InlineFragment', typeCondition, directives, selections };
    }
    if (token.kind !== 'Name') throw new Error(`expected a field name, got ${describeToken(token)}`);
    this.next();
    let name = token.value;
    let alias: string | null = null;
    const colonToken = this.peek();
    if (colonToken.kind === 'Punct' && colonToken.value === ':') {
      this.next();
      alias = name;
      name = this.expectName();
    }
    const args = this.parseArguments();
    const directives = this.parseDirectives();
    let selections: Selection[] | null = null;
    const braceToken = this.peek();
    if (braceToken.kind === 'Punct' && braceToken.value === '{') selections = this.parseSelectionSet();
    return { kind: 'Field', name, alias, args, directives, selections };
  }

  private parseArguments(): Array<{ name: string; value: Value }> {
    const args: Array<{ name: string; value: Value }> = [];
    const openToken = this.peek();
    if (!(openToken.kind === 'Punct' && openToken.value === '(')) return args;
    this.next();
    for (;;) {
      const token = this.peek();
      if (token.kind === 'Punct' && token.value === ')') {
        this.next();
        return args;
      }
      const name = this.expectName();
      this.expectPunct(':');
      args.push({ name, value: this.parseValue() });
    }
  }

  private parseDirectives(): Directive[] {
    const directives: Directive[] = [];
    for (;;) {
      const atToken = this.peek();
      if (!(atToken.kind === 'Punct' && atToken.value === '@')) break;
      this.next();
      const name = this.expectName();
      const args = this.parseArguments();
      directives.push({ name, args });
    }
    return directives;
  }

  private parseValue(): Value {
    const token = this.next();
    if (token.kind === 'Punct' && token.value === '$') return { kind: 'Variable', name: this.expectName() };
    if (token.kind === 'String') return { kind: 'String', value: token.value };
    if (token.kind === 'Int') return { kind: 'Int', value: parseInt(token.value, 10) };
    if (token.kind === 'Float') return { kind: 'Float', value: parseFloat(token.value) };
    if (token.kind === 'Punct' && token.value === '[') {
      const values: Value[] = [];
      for (;;) {
        const next = this.peek();
        if (next.kind === 'Punct' && next.value === ']') {
          this.next();
          return { kind: 'List', values };
        }
        values.push(this.parseValue());
      }
    }
    if (token.kind === 'Punct' && token.value === '{') {
      const fields: Array<{ name: string; value: Value }> = [];
      for (;;) {
        const next = this.peek();
        if (next.kind === 'Punct' && next.value === '}') {
          this.next();
          return { kind: 'Object', fields };
        }
        const name = this.expectName();
        this.expectPunct(':');
        fields.push({ name, value: this.parseValue() });
      }
    }
    if (token.kind === 'Name') {
      if (token.value === 'true') return { kind: 'Boolean', value: true };
      if (token.value === 'false') return { kind: 'Boolean', value: false };
      if (token.value === 'null') return { kind: 'Null' };
      return { kind: 'Enum', value: token.value };
    }
    throw new Error(`unexpected value token ${describeToken(token)}`);
  }
}

export function parseDocument(source: string): Document {
  return new Parser(lex(source)).parseDocument();
}

// ---------------------------------------------------------------------------------------------
// Value evaluation
// ---------------------------------------------------------------------------------------------

function evaluateValue(value: Value, variables: Record<string, unknown>): unknown {
  switch (value.kind) {
    case 'Variable':
      return variables[value.name] ?? null;
    case 'String':
    case 'Int':
    case 'Float':
    case 'Boolean':
      return value.value;
    case 'Null':
      return null;
    case 'Enum':
      return value.value;
    case 'List':
      return value.values.map((item) => evaluateValue(item, variables));
    case 'Object': {
      const out: Record<string, unknown> = {};
      for (const field of value.fields) out[field.name] = evaluateValue(field.value, variables);
      return out;
    }
  }
}

function evaluateArgs(args: Array<{ name: string; value: Value }>, variables: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const arg of args) out[arg.name] = evaluateValue(arg.value, variables);
  return out;
}

/** @include/@skip: false when a directive says to skip this selection. */
function includeSelection(directives: Directive[], variables: Record<string, unknown>): boolean {
  for (const directive of directives) {
    const ifArg = directive.args.find((arg) => arg.name === 'if');
    if (ifArg === undefined) continue;
    const value = evaluateValue(ifArg.value, variables);
    if (directive.name === 'include' && value !== true) return false;
    if (directive.name === 'skip' && value === true) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Schema: type references, field specs, resolvers
// ---------------------------------------------------------------------------------------------

export type TypeRef =
  | { kind: 'NON_NULL'; ofType: TypeRef }
  | { kind: 'LIST'; ofType: TypeRef }
  | { kind: 'SCALAR' | 'OBJECT' | 'ENUM' | 'INPUT_OBJECT' | 'INTERFACE' | 'UNION'; name: string };

const nn = (t: TypeRef): TypeRef => ({ kind: 'NON_NULL', ofType: t });
const list = (t: TypeRef): TypeRef => ({ kind: 'LIST', ofType: t });
const named = (kind: TypeRef['kind'], name: string): TypeRef => ({ kind, name }) as TypeRef;
const STR = named('SCALAR', 'String');
const INT = named('SCALAR', 'Int');
const BOOL = named('SCALAR', 'Boolean');
const ID = named('SCALAR', 'ID');

export interface GqlCtx {
  store: Store;
}

type Resolver = (parent: any, args: Record<string, unknown>, ctx: GqlCtx) => unknown;

interface FieldSpec {
  type: TypeRef;
  args?: Array<{ name: string; type: TypeRef }>;
  resolve: Resolver;
}

interface TypeDef {
  kind: 'OBJECT' | 'SCALAR' | 'ENUM' | 'INPUT_OBJECT';
  fields?: Record<string, FieldSpec>;
  enumValues?: string[];
  inputFields?: Array<{ name: string; type: TypeRef }>;
}

const CREATED_AT = '2025-01-01T00:00:00Z';

function userObject(login: string, id: number, name: string, email: string): Record<string, unknown> {
  return { __typename: 'User', login, id: String(id), name, email };
}

function viewerUser(): Record<string, unknown> {
  return userObject('adaiversen', VIEWER_ID, VIEWER_NAME, VIEWER_EMAIL);
}

function repoObject(repo: Repo): Record<string, unknown> {
  return { __typename: 'Repository', repo };
}

function issueObject(repo: Repo, issue: Issue): Record<string, unknown> {
  return { __typename: 'Issue', repo, issue };
}

function pullObject(repo: Repo, pull: Pull): Record<string, unknown> {
  return { __typename: 'PullRequest', repo, pull };
}

function issueState(issue: Issue): string {
  return issue.state === 'open' ? 'OPEN' : 'CLOSED';
}

function pullState(pull: Pull): string {
  if (pull.merged) return 'MERGED';
  return pull.state === 'open' ? 'OPEN' : 'CLOSED';
}

function encodeCursor(value: string): string {
  return Buffer.from(`cursor:${value}`, 'utf8').toString('base64');
}

function decodeCursor(cursor: string): string | null {
  try {
    const text = Buffer.from(cursor, 'base64').toString('utf8');
    if (!text.startsWith('cursor:')) return null;
    return text.slice('cursor:'.length);
  } catch {
    return null;
  }
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/** Paginate an ordered list by first/after, returning nodes/edges/pageInfo/totalCount. */
function paginateConnection<T>(
  items: readonly T[],
  args: Record<string, unknown>,
  cursorFor: (item: T) => string,
): { nodes: T[]; edges: Array<{ node: T; cursor: string }>; pageInfo: PageInfo; totalCount: number } {
  const after = typeof args.after === 'string' ? decodeCursor(args.after) : null;
  let startIndex = 0;
  if (after !== null) {
    const index = items.findIndex((item) => cursorFor(item) === after);
    startIndex = index >= 0 ? index + 1 : items.length;
  }
  const first = typeof args.first === 'number' && Number.isFinite(args.first) && args.first >= 0 ? Math.trunc(args.first) : items.length;
  const page = items.slice(startIndex, startIndex + first);
  const edges = page.map((item) => ({ node: item, cursor: encodeCursor(cursorFor(item)) }));
  return {
    nodes: page,
    edges,
    pageInfo: {
      hasNextPage: startIndex + page.length < items.length,
      hasPreviousPage: startIndex > 0,
      startCursor: edges.length > 0 ? edges[0]!.cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1]!.cursor : null,
    },
    totalCount: items.length,
  };
}

function issueConnection(repo: Repo, issues: Issue[], args: Record<string, unknown>): Record<string, unknown> {
  const sorted = [...issues].sort((a, b) => {
    const direction = (args.orderBy as Record<string, unknown> | undefined)?.direction === 'ASC' ? 1 : -1;
    return direction * (a.number - b.number);
  });
  const page = paginateConnection(sorted, args, (issue) => String(issue.number));
  return {
    __typename: 'IssueConnection',
    nodes: page.nodes.map((issue) => issueObject(repo, issue)),
    edges: page.edges.map((edge) => ({ __typename: 'IssueEdge', node: issueObject(repo, edge.node), cursor: edge.cursor })),
    pageInfo: { __typename: 'PageInfo', ...page.pageInfo },
    totalCount: page.totalCount,
  };
}

function pullConnection(repo: Repo, pulls: Pull[], args: Record<string, unknown>): Record<string, unknown> {
  const sorted = [...pulls].sort((a, b) => {
    const direction = (args.orderBy as Record<string, unknown> | undefined)?.direction === 'ASC' ? 1 : -1;
    return direction * (a.number - b.number);
  });
  const page = paginateConnection(sorted, args, (pull) => String(pull.number));
  return {
    __typename: 'PullRequestConnection',
    nodes: page.nodes.map((pull) => pullObject(repo, pull)),
    edges: page.edges.map((edge) => ({ __typename: 'PullRequestEdge', node: pullObject(repo, edge.node), cursor: edge.cursor })),
    pageInfo: { __typename: 'PageInfo', ...page.pageInfo },
    totalCount: page.totalCount,
  };
}

function labelConnection(repo: Repo, names: string[], args: Record<string, unknown>): Record<string, unknown> {
  const labels = [...names].sort().map((name) => ({ __typename: 'Label', name, color: repo.labels.get(name)?.color ?? 'ededed' }));
  const page = paginateConnection(labels, args, (label) => String(label.name));
  return {
    __typename: 'LabelConnection',
    nodes: page.nodes,
    edges: page.edges.map((edge) => ({ __typename: 'LabelEdge', node: edge.node, cursor: edge.cursor })),
    pageInfo: { __typename: 'PageInfo', ...page.pageInfo },
    totalCount: page.totalCount,
  };
}

function commentConnection(store: Store, repo: Repo, number: number, args: Record<string, unknown>): Record<string, unknown> {
  const comments = (repo.comments.get(number) ?? []).map((comment) => ({
    __typename: 'IssueComment',
    id: store.commentGlobalId(repo, number, comment.id),
    commentId: comment.id,
    body: comment.body,
    repo,
    number,
  }));
  const page = paginateConnection(comments, args, (comment) => String(comment.commentId));
  return {
    __typename: 'IssueCommentConnection',
    nodes: page.nodes,
    edges: page.edges.map((edge) => ({ __typename: 'IssueCommentEdge', node: edge.node, cursor: edge.cursor })),
    pageInfo: { __typename: 'PageInfo', ...page.pageInfo },
    totalCount: page.totalCount,
  };
}

function fileConnection(store: Store, repo: Repo, pull: Pull, args: Record<string, unknown>): Record<string, unknown> {
  const headTip = repo.refs.get(`refs/heads/${pull.headRef}`);
  if (headTip === undefined) {
    return { __typename: 'PullRequestChangedFileConnection', nodes: [], edges: [], pageInfo: { __typename: 'PageInfo', hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }, totalCount: 0 };
  }
  const headCommit = parseCommit(repo.objects.get(headTip)!.data);
  const baseCommit = parseCommit(repo.objects.get(pull.baseSha)!.data);
  const changes = store.diffTrees(repo, baseCommit.tree, headCommit.tree);
  const files = changes.map((change) => ({
    __typename: 'PullRequestChangedFile',
    path: change.path,
    additions: change.status === 'deleted' ? 0 : Math.max(1, change.additions),
    deletions: change.status === 'added' ? 0 : change.deletions,
    changeType: change.status === 'deleted' ? 'REMOVED' : change.status === 'added' ? 'ADDED' : 'MODIFIED',
  }));
  const page = paginateConnection(files, args, (file) => file.path);
  return {
    __typename: 'PullRequestChangedFileConnection',
    nodes: page.nodes,
    edges: page.edges.map((edge) => ({ __typename: 'PullRequestChangedFileEdge', node: edge.node, cursor: edge.cursor })),
    pageInfo: { __typename: 'PageInfo', ...page.pageInfo },
    totalCount: page.totalCount,
  };
}

// ---------------------------------------------------------------------------------------------
// Field tables (resolvers + introspection types)
// ---------------------------------------------------------------------------------------------

const ISSUE_STATE = named('ENUM', 'IssueState');
const PULL_STATE = named('ENUM', 'PullRequestState');
const MERGEABLE_STATE = named('ENUM', 'MergeableState');
const ISSUE_ORDER = named('INPUT_OBJECT', 'IssueOrder');
const PULL_ORDER = named('INPUT_OBJECT', 'PullRequestOrder');

function arg(name: string, type: TypeRef): { name: string; type: TypeRef } {
  return { name, type };
}

const FIELDS: Record<string, Record<string, FieldSpec>> = {
  Query: {
    viewer: { type: nn(named('OBJECT', 'User')), resolve: () => viewerUser() },
    repository: {
      type: named('OBJECT', 'Repository'),
      args: [arg('owner', nn(STR)), arg('name', nn(STR))],
      resolve: (_parent, args, ctx) => {
        const repo = ctx.store.getRepo(String(args.owner ?? ''), String(args.name ?? ''));
        return repo === undefined ? null : repoObject(repo);
      },
    },
    node: {
      type: named('INTERFACE', 'Node'),
      args: [arg('id', nn(ID))],
      resolve: (_parent, args, ctx) => {
        const resolved = ctx.store.resolveGlobalId(String(args.id ?? ''));
        if (resolved === null) return null;
        if (resolved.kind === 'repo') return repoObject(resolved.repo);
        if (resolved.kind === 'issue') {
          const issue = resolved.repo.issues.get(resolved.number);
          return issue === undefined ? null : issueObject(resolved.repo, issue);
        }
        if (resolved.kind === 'pr') {
          const pull = resolved.repo.pulls.get(resolved.number);
          return pull === undefined ? null : pullObject(resolved.repo, pull);
        }
        return null;
      },
    },
    __type: {
      type: named('OBJECT', '__Type'),
      args: [arg('name', nn(STR))],
      resolve: (_parent, args) => makeTypeObject(String(args.name ?? '')),
    },
    __schema: { type: nn(named('OBJECT', '__Schema')), resolve: () => ({ __typename: '__Schema' }) },
  },
  Mutation: {
    createIssue: {
      type: named('OBJECT', 'CreateIssuePayload'),
      args: [arg('input', nn(named('INPUT_OBJECT', 'CreateIssueInput')))],
      resolve: (_parent, args, ctx) => {
        const input = (args.input ?? {}) as Record<string, unknown>;
        const resolved = ctx.store.resolveGlobalId(String(input.repositoryId ?? ''));
        if (resolved === null || resolved.kind !== 'repo') throw new Error('repositoryId does not identify a repository');
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (title === '') throw new Error('title is required');
        const repo = resolved.repo;
        const number = repo.seq;
        repo.seq += 1;
        const issue: Issue = { id: ctx.store.nextGlobalId, number, title, body: typeof input.body === 'string' ? input.body : '', state: 'open', labels: [], createdSeq: number };
        ctx.store.nextGlobalId += 1;
        repo.issues.set(number, issue);
        return { __typename: 'CreateIssuePayload', issue: issueObject(repo, issue), clientMutationId: (input.clientMutationId as string | null) ?? null };
      },
    },
    closeIssue: {
      type: named('OBJECT', 'CloseIssuePayload'),
      args: [arg('input', nn(named('INPUT_OBJECT', 'CloseIssueInput')))],
      resolve: (_parent, args, ctx) => {
        const input = (args.input ?? {}) as Record<string, unknown>;
        const resolved = ctx.store.resolveGlobalId(String(input.issueId ?? ''));
        if (resolved === null || resolved.kind !== 'issue') throw new Error('issueId does not identify an issue');
        const issue = resolved.repo.issues.get(resolved.number);
        if (issue === undefined) throw new Error('issue not found');
        issue.state = 'closed';
        return { __typename: 'CloseIssuePayload', issue: issueObject(resolved.repo, issue), clientMutationId: (input.clientMutationId as string | null) ?? null };
      },
    },
    createPullRequest: {
      type: named('OBJECT', 'CreatePullRequestPayload'),
      args: [arg('input', nn(named('INPUT_OBJECT', 'CreatePullRequestInput')))],
      resolve: (_parent, args, ctx) => {
        const input = (args.input ?? {}) as Record<string, unknown>;
        const resolved = ctx.store.resolveGlobalId(String(input.repositoryId ?? ''));
        if (resolved === null || resolved.kind !== 'repo') throw new Error('repositoryId does not identify a repository');
        const repo = resolved.repo;
        const head = String(input.headRefName ?? '');
        const base = String(input.baseRefName ?? '');
        const headTip = repo.refs.get(`refs/heads/${head}`);
        const baseTip = repo.refs.get(`refs/heads/${base}`);
        if (headTip === undefined || baseTip === undefined) throw new Error('head or base branch does not exist');
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (title === '') throw new Error('title is required');
        const number = repo.seq;
        repo.seq += 1;
        const pull: Pull = {
          id: ctx.store.nextGlobalId,
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
        ctx.store.nextGlobalId += 1;
        repo.pulls.set(number, pull);
        return { __typename: 'CreatePullRequestPayload', pullRequest: pullObject(repo, pull), clientMutationId: (input.clientMutationId as string | null) ?? null };
      },
    },
    mergePullRequest: {
      type: named('OBJECT', 'MergePullRequestPayload'),
      args: [arg('input', nn(named('INPUT_OBJECT', 'MergePullRequestInput')))],
      resolve: (_parent, args, ctx) => {
        const input = (args.input ?? {}) as Record<string, unknown>;
        const resolved = ctx.store.resolveGlobalId(String(input.pullRequestId ?? ''));
        if (resolved === null || resolved.kind !== 'pr') throw new Error('pullRequestId does not identify a pull request');
        const pull = resolved.repo.pulls.get(resolved.number);
        if (pull === undefined) throw new Error('pull request not found');
        if (pull.state === 'closed') throw new Error('pull request is already merged or closed');
        if (ctx.store.pullConflicts(resolved.repo, pull)) throw new Error('merge conflict');
        const mergeOid = ctx.store.mergePull(resolved.repo, pull);
        if (mergeOid === null) throw new Error('merge conflict');
        pull.state = 'closed';
        pull.merged = true;
        pull.mergedAt = MERGED_AT;
        pull.mergeCommitSha = mergeOid;
        return { __typename: 'MergePullRequestPayload', pullRequest: pullObject(resolved.repo, pull), clientMutationId: (input.clientMutationId as string | null) ?? null };
      },
    },
    addComment: {
      type: named('OBJECT', 'AddCommentPayload'),
      args: [arg('input', nn(named('INPUT_OBJECT', 'AddCommentInput')))],
      resolve: (_parent, args, ctx) => {
        const input = (args.input ?? {}) as Record<string, unknown>;
        const resolved = ctx.store.resolveGlobalId(String(input.subjectId ?? ''));
        if (resolved === null || resolved.kind !== 'issue') throw new Error('subjectId does not identify an issue');
        const repo = resolved.repo;
        const issue = repo.issues.get(resolved.number);
        if (issue === undefined) throw new Error('issue not found');
        const body = typeof input.body === 'string' ? input.body : '';
        if (body === '') throw new Error('body is required');
        const comment = { id: ctx.store.nextCommentId, body };
        ctx.store.nextCommentId += 1;
        const list = repo.comments.get(resolved.number) ?? [];
        list.push(comment);
        repo.comments.set(resolved.number, list);
        const commentObject = {
          __typename: 'IssueComment',
          id: ctx.store.commentGlobalId(repo, resolved.number, comment.id),
          commentId: comment.id,
          body,
          repo,
          number: resolved.number,
        };
        const edge = { __typename: 'IssueCommentEdge', node: commentObject, cursor: encodeCursor(String(comment.id)) };
        return {
          __typename: 'AddCommentPayload',
          comment: commentObject,
          commentEdge: edge,
          subject: issueObject(repo, issue),
          clientMutationId: (input.clientMutationId as string | null) ?? null,
        };
      },
    },
  },
  User: {
    login: { type: nn(STR), resolve: (parent) => parent.login },
    id: { type: nn(ID), resolve: (parent) => parent.id },
    name: { type: STR, resolve: (parent) => parent.name ?? null },
    email: { type: STR, resolve: (parent) => parent.email ?? null },
  },
  Repository: {
    id: {
      type: nn(ID),
      resolve: (parent, _args, ctx) => ctx.store.repoGlobalId(parent.repo as Repo),
    },
    databaseId: { type: nn(INT), resolve: (parent) => (parent.repo as Repo).id },
    name: { type: nn(STR), resolve: (parent) => (parent.repo as Repo).name },
    nameWithOwner: { type: nn(STR), resolve: (parent) => `${(parent.repo as Repo).owner}/${(parent.repo as Repo).name}` },
    owner: {
      type: nn(named('OBJECT', 'User')),
      resolve: (parent) => {
        const repo = parent.repo as Repo;
        return repo.owner === 'adaiversen' ? viewerUser() : userObject(repo.owner, 2000, repo.owner, `${repo.owner}@example.invalid`);
      },
    },
    description: { type: STR, resolve: (parent) => (parent.repo as Repo).description },
    url: { type: STR, resolve: (parent) => `https://github.example/${(parent.repo as Repo).owner}/${(parent.repo as Repo).name}` },
    defaultBranchRef: {
      type: named('OBJECT', 'Ref'),
      resolve: (parent) => {
        const repo = parent.repo as Repo;
        const tip = repo.refs.get(`refs/heads/${repo.defaultBranch}`);
        if (tip === undefined) return null;
        return { __typename: 'Ref', name: repo.defaultBranch, oid: tip, repo };
      },
    },
    viewerPermission: { type: STR, resolve: () => 'ADMIN' },
    hasIssuesEnabled: { type: nn(BOOL), resolve: () => true },
    issue: {
      type: named('OBJECT', 'Issue'),
      args: [arg('number', nn(INT))],
      resolve: (parent, args) => {
        const repo = parent.repo as Repo;
        const issue = repo.issues.get(Number(args.number));
        return issue === undefined ? null : issueObject(repo, issue);
      },
    },
    issues: {
      type: nn(named('OBJECT', 'IssueConnection')),
      args: [arg('first', INT), arg('after', STR), arg('states', list(nn(ISSUE_STATE))), arg('orderBy', ISSUE_ORDER)],
      resolve: (parent, args, ctx) => {
        const repo = parent.repo as Repo;
        let issues = [...repo.issues.values()];
        const states = args.states as string[] | undefined;
        if (Array.isArray(states) && states.length > 0) {
          const wanted = new Set(states.map((state) => String(state).toLowerCase()));
          issues = issues.filter((issue) => wanted.has(issue.state));
        }
        return issueConnection(repo, issues, args);
      },
    },
    pullRequests: {
      type: nn(named('OBJECT', 'PullRequestConnection')),
      args: [arg('first', INT), arg('after', STR), arg('states', list(nn(PULL_STATE))), arg('orderBy', PULL_ORDER)],
      resolve: (parent, args) => {
        const repo = parent.repo as Repo;
        let pulls = [...repo.pulls.values()];
        const states = args.states as string[] | undefined;
        if (Array.isArray(states) && states.length > 0) {
          const wanted = new Set(states.map((state) => String(state).toUpperCase()));
          pulls = pulls.filter((pull) => wanted.has(pullState(pull)));
        }
        return pullConnection(repo, pulls, args);
      },
    },
    pullRequest: {
      type: named('OBJECT', 'PullRequest'),
      args: [arg('number', nn(INT))],
      resolve: (parent, args) => {
        const repo = parent.repo as Repo;
        const pull = repo.pulls.get(Number(args.number));
        return pull === undefined ? null : pullObject(repo, pull);
      },
    },
  },
  Ref: {
    name: { type: nn(STR), resolve: (parent) => parent.name },
    target: {
      type: named('OBJECT', 'Commit'),
      resolve: (parent) => ({ __typename: 'Commit', oid: parent.oid, repo: parent.repo }),
    },
  },
  Commit: {
    oid: { type: nn(STR), resolve: (parent) => parent.oid },
    message: {
      type: STR,
      resolve: (parent) => {
        const repo = parent.repo as Repo;
        const object = repo.objects.get(parent.oid as string);
        if (object === undefined || object.type !== 'commit') return null;
        return parseCommit(object.data).message.replace(/\n+$/, '');
      },
    },
  },
  Issue: {
    id: {
      type: nn(ID),
      resolve: (parent, _args, ctx) => ctx.store.issueGlobalId(parent.repo as Repo, (parent.issue as Issue).number),
    },
    databaseId: { type: nn(INT), resolve: (parent) => (parent.issue as Issue).id },
    number: { type: nn(INT), resolve: (parent) => (parent.issue as Issue).number },
    title: { type: nn(STR), resolve: (parent) => (parent.issue as Issue).title },
    body: { type: STR, resolve: (parent) => (parent.issue as Issue).body },
    state: { type: nn(ISSUE_STATE), resolve: (parent) => issueState(parent.issue as Issue) },
    url: { type: STR, resolve: (parent) => `https://github.example/${(parent.repo as Repo).owner}/${(parent.repo as Repo).name}/issues/${(parent.issue as Issue).number}` },
    createdAt: { type: STR, resolve: () => CREATED_AT },
    author: { type: named('OBJECT', 'User'), resolve: () => viewerUser() },
    labels: {
      type: named('OBJECT', 'LabelConnection'),
      args: [arg('first', INT), arg('after', STR)],
      resolve: (parent, args) => labelConnection(parent.repo as Repo, (parent.issue as Issue).labels, args),
    },
    comments: {
      type: named('OBJECT', 'IssueCommentConnection'),
      args: [arg('first', INT), arg('after', STR)],
      resolve: (parent, args, ctx) => commentConnection(ctx.store, parent.repo as Repo, (parent.issue as Issue).number, args),
    },
  },
  PullRequest: {
    id: {
      type: nn(ID),
      resolve: (parent, _args, ctx) => ctx.store.pullGlobalId(parent.repo as Repo, (parent.pull as Pull).number),
    },
    databaseId: { type: nn(INT), resolve: (parent) => (parent.pull as Pull).id },
    number: { type: nn(INT), resolve: (parent) => (parent.pull as Pull).number },
    title: { type: nn(STR), resolve: (parent) => (parent.pull as Pull).title },
    body: { type: STR, resolve: (parent) => (parent.pull as Pull).body },
    state: { type: nn(PULL_STATE), resolve: (parent) => pullState(parent.pull as Pull) },
    merged: { type: nn(BOOL), resolve: (parent) => (parent.pull as Pull).merged },
    mergeable: {
      type: nn(MERGEABLE_STATE),
      resolve: (parent, _args, ctx) =>
        ctx.store.pullConflicts(parent.repo as Repo, parent.pull as Pull) ? 'CONFLICTING' : 'MERGEABLE',
    },
    headRefName: { type: STR, resolve: (parent) => (parent.pull as Pull).headRef },
    baseRefName: { type: STR, resolve: (parent) => (parent.pull as Pull).baseRef },
    headRefOid: {
      type: STR,
      resolve: (parent) => (parent.repo as Repo).refs.get(`refs/heads/${(parent.pull as Pull).headRef}`) ?? null,
    },
    baseRefOid: {
      type: STR,
      resolve: (parent) => (parent.repo as Repo).refs.get(`refs/heads/${(parent.pull as Pull).baseRef}`) ?? null,
    },
    mergeCommit: {
      type: named('OBJECT', 'Commit'),
      resolve: (parent) => {
        const pull = parent.pull as Pull;
        if (pull.mergeCommitSha === null) return null;
        return { __typename: 'Commit', oid: pull.mergeCommitSha, repo: parent.repo };
      },
    },
    url: { type: STR, resolve: (parent) => `https://github.example/${(parent.repo as Repo).owner}/${(parent.repo as Repo).name}/pull/${(parent.pull as Pull).number}` },
    createdAt: { type: STR, resolve: () => CREATED_AT },
    author: { type: named('OBJECT', 'User'), resolve: () => viewerUser() },
    files: {
      type: named('OBJECT', 'PullRequestChangedFileConnection'),
      args: [arg('first', INT), arg('after', STR)],
      resolve: (parent, args, ctx) => fileConnection(ctx.store, parent.repo as Repo, parent.pull as Pull, args),
    },
  },
  Label: {
    id: { type: nn(ID), resolve: (parent) => encodeCursor(`label:${String(parent.name)}`) },
    name: { type: nn(STR), resolve: (parent) => parent.name },
    color: { type: nn(STR), resolve: (parent) => parent.color },
  },
  IssueComment: {
    id: { type: nn(ID), resolve: (parent) => parent.id },
    body: { type: nn(STR), resolve: (parent) => parent.body },
    author: { type: named('OBJECT', 'User'), resolve: () => viewerUser() },
  },
  PullRequestChangedFile: {
    path: { type: nn(STR), resolve: (parent) => parent.path },
    additions: { type: nn(INT), resolve: (parent) => parent.additions },
    deletions: { type: nn(INT), resolve: (parent) => parent.deletions },
    changeType: { type: nn(STR), resolve: (parent) => parent.changeType },
  },
  IssueConnection: {
    nodes: { type: list(named('OBJECT', 'Issue')), resolve: (parent) => parent.nodes },
    edges: { type: list(named('OBJECT', 'IssueEdge')), resolve: (parent) => parent.edges },
    pageInfo: { type: nn(named('OBJECT', 'PageInfo')), resolve: (parent) => parent.pageInfo },
    totalCount: { type: nn(INT), resolve: (parent) => parent.totalCount },
  },
  IssueEdge: {
    node: { type: named('OBJECT', 'Issue'), resolve: (parent) => parent.node },
    cursor: { type: nn(STR), resolve: (parent) => parent.cursor },
  },
  PullRequestConnection: {
    nodes: { type: list(named('OBJECT', 'PullRequest')), resolve: (parent) => parent.nodes },
    edges: { type: list(named('OBJECT', 'PullRequestEdge')), resolve: (parent) => parent.edges },
    pageInfo: { type: nn(named('OBJECT', 'PageInfo')), resolve: (parent) => parent.pageInfo },
    totalCount: { type: nn(INT), resolve: (parent) => parent.totalCount },
  },
  PullRequestEdge: {
    node: { type: named('OBJECT', 'PullRequest'), resolve: (parent) => parent.node },
    cursor: { type: nn(STR), resolve: (parent) => parent.cursor },
  },
  LabelConnection: {
    nodes: { type: list(named('OBJECT', 'Label')), resolve: (parent) => parent.nodes },
    edges: { type: list(named('OBJECT', 'LabelEdge')), resolve: (parent) => parent.edges },
    pageInfo: { type: nn(named('OBJECT', 'PageInfo')), resolve: (parent) => parent.pageInfo },
    totalCount: { type: nn(INT), resolve: (parent) => parent.totalCount },
  },
  LabelEdge: {
    node: { type: named('OBJECT', 'Label'), resolve: (parent) => parent.node },
    cursor: { type: nn(STR), resolve: (parent) => parent.cursor },
  },
  IssueCommentConnection: {
    nodes: { type: list(named('OBJECT', 'IssueComment')), resolve: (parent) => parent.nodes },
    edges: { type: list(named('OBJECT', 'IssueCommentEdge')), resolve: (parent) => parent.edges },
    pageInfo: { type: nn(named('OBJECT', 'PageInfo')), resolve: (parent) => parent.pageInfo },
    totalCount: { type: nn(INT), resolve: (parent) => parent.totalCount },
  },
  IssueCommentEdge: {
    node: { type: named('OBJECT', 'IssueComment'), resolve: (parent) => parent.node },
    cursor: { type: nn(STR), resolve: (parent) => parent.cursor },
  },
  PullRequestChangedFileConnection: {
    nodes: { type: list(named('OBJECT', 'PullRequestChangedFile')), resolve: (parent) => parent.nodes },
    edges: { type: list(named('OBJECT', 'PullRequestChangedFileEdge')), resolve: (parent) => parent.edges },
    pageInfo: { type: nn(named('OBJECT', 'PageInfo')), resolve: (parent) => parent.pageInfo },
    totalCount: { type: nn(INT), resolve: (parent) => parent.totalCount },
  },
  PullRequestChangedFileEdge: {
    node: { type: named('OBJECT', 'PullRequestChangedFile'), resolve: (parent) => parent.node },
    cursor: { type: nn(STR), resolve: (parent) => parent.cursor },
  },
  PageInfo: {
    hasNextPage: { type: nn(BOOL), resolve: (parent) => parent.hasNextPage },
    hasPreviousPage: { type: nn(BOOL), resolve: (parent) => parent.hasPreviousPage },
    startCursor: { type: STR, resolve: (parent) => parent.startCursor },
    endCursor: { type: STR, resolve: (parent) => parent.endCursor },
  },
  CreateIssuePayload: {
    issue: { type: named('OBJECT', 'Issue'), resolve: (parent) => parent.issue },
    clientMutationId: { type: STR, resolve: (parent) => parent.clientMutationId },
  },
  CloseIssuePayload: {
    issue: { type: named('OBJECT', 'Issue'), resolve: (parent) => parent.issue },
    clientMutationId: { type: STR, resolve: (parent) => parent.clientMutationId },
  },
  CreatePullRequestPayload: {
    pullRequest: { type: named('OBJECT', 'PullRequest'), resolve: (parent) => parent.pullRequest },
    clientMutationId: { type: STR, resolve: (parent) => parent.clientMutationId },
  },
  MergePullRequestPayload: {
    pullRequest: { type: named('OBJECT', 'PullRequest'), resolve: (parent) => parent.pullRequest },
    clientMutationId: { type: STR, resolve: (parent) => parent.clientMutationId },
  },
  AddCommentPayload: {
    comment: { type: named('OBJECT', 'IssueComment'), resolve: (parent) => parent.comment },
    commentEdge: { type: named('OBJECT', 'IssueCommentEdge'), resolve: (parent) => parent.commentEdge },
    subject: { type: named('INTERFACE', 'Node'), resolve: (parent) => parent.subject },
    clientMutationId: { type: STR, resolve: (parent) => parent.clientMutationId },
  },
  __Type: {
    name: { type: STR, resolve: (parent) => parent._name },
    kind: { type: nn(STR), resolve: (parent) => parent._kind },
    description: { type: STR, resolve: () => null },
    fields: {
      type: list(named('OBJECT', '__Field')),
      args: [arg('includeDeprecated', BOOL)],
      resolve: (parent) => {
        const def = parent._def as TypeDef | null;
        if (def === undefined || def === null || def.fields === undefined) return null;
        return Object.entries(def.fields).map(([name, spec]) => ({
          __typename: '__Field',
          name,
          args: (spec.args ?? []).map((a) => makeInputValue(a.name, a.type)),
          type: makeTypeObjectFromRef(spec.type),
        }));
      },
    },
    enumValues: {
      type: list(named('OBJECT', '__EnumValue')),
      args: [arg('includeDeprecated', BOOL)],
      resolve: (parent) => {
        const def = parent._def as TypeDef | null;
        if (def === undefined || def === null || def.enumValues === undefined) return null;
        return def.enumValues.map((name) => ({ __typename: '__EnumValue', name, description: null, isDeprecated: false, deprecationReason: null }));
      },
    },
    inputFields: {
      type: list(named('OBJECT', '__InputValue')),
      resolve: (parent) => {
        const def = parent._def as TypeDef | null;
        if (def === undefined || def === null || def.inputFields === undefined) return null;
        return def.inputFields.map((field) => makeInputValue(field.name, field.type));
      },
    },
    ofType: { type: named('OBJECT', '__Type'), resolve: (parent) => parent._ofType ?? null },
    interfaces: { type: list(named('OBJECT', '__Type')), resolve: () => [] },
    possibleTypes: { type: list(named('OBJECT', '__Type')), resolve: () => null },
  },
  __Field: {
    name: { type: nn(STR), resolve: (parent) => parent.name },
    description: { type: STR, resolve: () => null },
    args: { type: nn(list(nn(named('OBJECT', '__InputValue')))), resolve: (parent) => parent.args },
    type: { type: nn(named('OBJECT', '__Type')), resolve: (parent) => parent.type },
  },
  __InputValue: {
    name: { type: nn(STR), resolve: (parent) => parent.name },
    description: { type: STR, resolve: () => null },
    type: { type: nn(named('OBJECT', '__Type')), resolve: (parent) => parent.type },
    defaultValue: { type: STR, resolve: () => null },
  },
  __EnumValue: {
    name: { type: nn(STR), resolve: (parent) => parent.name },
    description: { type: STR, resolve: () => null },
    isDeprecated: { type: nn(BOOL), resolve: () => false },
    deprecationReason: { type: STR, resolve: () => null },
  },
  __Schema: {
    types: {
      type: nn(list(nn(named('OBJECT', '__Type')))),
      resolve: () => Object.keys(TYPES).sort().map((name) => makeTypeObject(name)),
    },
    queryType: { type: named('OBJECT', '__Type'), resolve: () => makeTypeObject('Query') },
    mutationType: { type: named('OBJECT', '__Type'), resolve: () => makeTypeObject('Mutation') },
    directives: { type: nn(list(nn(named('OBJECT', '__Directive')))), resolve: () => [] },
  },
  __Directive: {
    name: { type: nn(STR), resolve: (parent) => parent.name },
    description: { type: STR, resolve: () => null },
    locations: { type: nn(list(nn(STR))), resolve: () => [] },
    args: { type: nn(list(nn(named('OBJECT', '__InputValue')))), resolve: () => [] },
  },
};

// ---------------------------------------------------------------------------------------------
// Type table for introspection
// ---------------------------------------------------------------------------------------------

const TYPES: Record<string, TypeDef> = {
  Query: { kind: 'OBJECT', fields: FIELDS.Query },
  Mutation: { kind: 'OBJECT', fields: FIELDS.Mutation },
  User: { kind: 'OBJECT', fields: FIELDS.User },
  Repository: { kind: 'OBJECT', fields: FIELDS.Repository },
  Ref: { kind: 'OBJECT', fields: FIELDS.Ref },
  Commit: { kind: 'OBJECT', fields: FIELDS.Commit },
  Issue: { kind: 'OBJECT', fields: FIELDS.Issue },
  PullRequest: { kind: 'OBJECT', fields: FIELDS.PullRequest },
  Label: { kind: 'OBJECT', fields: FIELDS.Label },
  IssueComment: { kind: 'OBJECT', fields: FIELDS.IssueComment },
  PullRequestChangedFile: { kind: 'OBJECT', fields: FIELDS.PullRequestChangedFile },
  IssueConnection: { kind: 'OBJECT', fields: FIELDS.IssueConnection },
  IssueEdge: { kind: 'OBJECT', fields: FIELDS.IssueEdge },
  PullRequestConnection: { kind: 'OBJECT', fields: FIELDS.PullRequestConnection },
  PullRequestEdge: { kind: 'OBJECT', fields: FIELDS.PullRequestEdge },
  LabelConnection: { kind: 'OBJECT', fields: FIELDS.LabelConnection },
  LabelEdge: { kind: 'OBJECT', fields: FIELDS.LabelEdge },
  IssueCommentConnection: { kind: 'OBJECT', fields: FIELDS.IssueCommentConnection },
  IssueCommentEdge: { kind: 'OBJECT', fields: FIELDS.IssueCommentEdge },
  PullRequestChangedFileConnection: { kind: 'OBJECT', fields: FIELDS.PullRequestChangedFileConnection },
  PullRequestChangedFileEdge: { kind: 'OBJECT', fields: FIELDS.PullRequestChangedFileEdge },
  PageInfo: { kind: 'OBJECT', fields: FIELDS.PageInfo },
  CreateIssuePayload: { kind: 'OBJECT', fields: FIELDS.CreateIssuePayload },
  CloseIssuePayload: { kind: 'OBJECT', fields: FIELDS.CloseIssuePayload },
  CreatePullRequestPayload: { kind: 'OBJECT', fields: FIELDS.CreatePullRequestPayload },
  MergePullRequestPayload: { kind: 'OBJECT', fields: FIELDS.MergePullRequestPayload },
  AddCommentPayload: { kind: 'OBJECT', fields: FIELDS.AddCommentPayload },
  __Type: { kind: 'OBJECT', fields: FIELDS.__Type },
  __Field: { kind: 'OBJECT', fields: FIELDS.__Field },
  __InputValue: { kind: 'OBJECT', fields: FIELDS.__InputValue },
  __EnumValue: { kind: 'OBJECT', fields: FIELDS.__EnumValue },
  __Schema: { kind: 'OBJECT', fields: FIELDS.__Schema },
  __Directive: { kind: 'OBJECT', fields: FIELDS.__Directive },
  IssueState: { kind: 'ENUM', enumValues: ['OPEN', 'CLOSED'] },
  PullRequestState: { kind: 'ENUM', enumValues: ['OPEN', 'CLOSED', 'MERGED'] },
  MergeableState: { kind: 'ENUM', enumValues: ['MERGEABLE', 'CONFLICTING', 'UNKNOWN'] },
  SearchType: { kind: 'ENUM', enumValues: ['ISSUE', 'PULL_REQUEST', 'REPOSITORY', 'USER', 'DISCUSSION'] },
  IssueOrderField: { kind: 'ENUM', enumValues: ['CREATED_AT', 'UPDATED_AT', 'COMMENTS'] },
  OrderDirection: { kind: 'ENUM', enumValues: ['ASC', 'DESC'] },
  PullRequestOrderField: { kind: 'ENUM', enumValues: ['CREATED_AT', 'UPDATED_AT'] },
  MergeMethod: { kind: 'ENUM', enumValues: ['MERGE', 'SQUASH', 'REBASE'] },
  String: { kind: 'SCALAR' },
  Int: { kind: 'SCALAR' },
  Boolean: { kind: 'SCALAR' },
  ID: { kind: 'SCALAR' },
  IssueOrder: {
    kind: 'INPUT_OBJECT',
    inputFields: [
      { name: 'field', type: nn(named('ENUM', 'IssueOrderField')) },
      { name: 'direction', type: nn(named('ENUM', 'OrderDirection')) },
    ],
  },
  PullRequestOrder: {
    kind: 'INPUT_OBJECT',
    inputFields: [
      { name: 'field', type: nn(named('ENUM', 'PullRequestOrderField')) },
      { name: 'direction', type: nn(named('ENUM', 'OrderDirection')) },
    ],
  },
  CreateIssueInput: {
    kind: 'INPUT_OBJECT',
    inputFields: [
      { name: 'repositoryId', type: nn(ID) },
      { name: 'title', type: nn(STR) },
      { name: 'body', type: STR },
      { name: 'clientMutationId', type: STR },
    ],
  },
  CloseIssueInput: {
    kind: 'INPUT_OBJECT',
    inputFields: [
      { name: 'issueId', type: nn(ID) },
      { name: 'clientMutationId', type: STR },
    ],
  },
  CreatePullRequestInput: {
    kind: 'INPUT_OBJECT',
    inputFields: [
      { name: 'repositoryId', type: nn(ID) },
      { name: 'title', type: nn(STR) },
      { name: 'headRefName', type: nn(STR) },
      { name: 'baseRefName', type: nn(STR) },
      { name: 'body', type: STR },
      { name: 'clientMutationId', type: STR },
    ],
  },
  MergePullRequestInput: {
    kind: 'INPUT_OBJECT',
    inputFields: [
      { name: 'pullRequestId', type: nn(ID) },
      { name: 'mergeMethod', type: named('ENUM', 'MergeMethod') },
      { name: 'clientMutationId', type: STR },
    ],
  },
  AddCommentInput: {
    kind: 'INPUT_OBJECT',
    inputFields: [
      { name: 'subjectId', type: nn(ID) },
      { name: 'body', type: nn(STR) },
      { name: 'clientMutationId', type: STR },
    ],
  },
};

function makeInputValue(name: string, type: TypeRef): Record<string, unknown> {
  return { __typename: '__InputValue', name, type: makeTypeObjectFromRef(type) };
}

function makeTypeObjectFromRef(ref: TypeRef): Record<string, unknown> {
  if (ref.kind === 'NON_NULL' || ref.kind === 'LIST') {
    return { __typename: '__Type', _kind: ref.kind, _name: null, _def: null, _ofType: makeTypeObjectFromRef(ref.ofType) };
  }
  const def = TYPES[ref.name] ?? null;
  return { __typename: '__Type', _kind: ref.kind, _name: ref.name, _def: def, _ofType: null };
}

function makeTypeObject(name: string): Record<string, unknown> | null {
  const def = TYPES[name];
  if (def === undefined) return null;
  return { __typename: '__Type', _kind: def.kind, _name: name, _def: def, _ofType: null };
}

// ---------------------------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------------------------

interface ExecState {
  ctx: GqlCtx;
  variables: Record<string, unknown>;
  fragments: Map<string, Fragment>;
  errors: Array<{ message: string }>;
}

function completeValue(value: unknown, selections: Selection[] | null, state: ExecState): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => completeValue(item, selections, state));
  if (typeof value === 'object' && (value as Record<string, unknown>).__typename !== undefined) {
    if (selections === null) return value;
    return executeSelections(selections, value as Record<string, unknown>, state);
  }
  return value;
}

function executeSelections(selections: Selection[], parent: Record<string, unknown>, state: ExecState): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const typeName = String(parent.__typename ?? 'Query');
  for (const selection of selections) {
    if (selection.kind === 'FragmentSpread') {
      if (!includeSelection(selection.directives, state.variables)) continue;
      const fragment = state.fragments.get(selection.name);
      if (fragment === undefined) {
        state.errors.push({ message: `Unknown fragment "${selection.name}".` });
        continue;
      }
      Object.assign(result, executeSelections(fragment.selections, parent, state));
      continue;
    }
    if (selection.kind === 'InlineFragment') {
      if (!includeSelection(selection.directives, state.variables)) continue;
      if (selection.typeCondition !== null && selection.typeCondition !== typeName) continue;
      Object.assign(result, executeSelections(selection.selections, parent, state));
      continue;
    }
    if (!includeSelection(selection.directives, state.variables)) continue;
    const responseKey = selection.alias ?? selection.name;
    if (selection.name === '__typename') {
      result[responseKey] = typeName;
      continue;
    }
    const fields = FIELDS[typeName];
    const spec = fields?.[selection.name];
    if (spec === undefined) {
      state.errors.push({ message: `Cannot query field "${selection.name}" on type "${typeName}".` });
      result[responseKey] = null;
      continue;
    }
    const args = evaluateArgs(selection.args, state.variables);
    let value: unknown;
    try {
      value = spec.resolve(parent, args, state.ctx);
    } catch (err) {
      state.errors.push({ message: (err as Error).message });
      result[responseKey] = null;
      continue;
    }
    result[responseKey] = completeValue(value, selection.selections, state);
  }
  return result;
}

function executeOperation(operation: Operation, document: Document, ctx: GqlCtx, variables: Record<string, unknown>): Record<string, unknown> {
  const state: ExecState = { ctx, variables, fragments: document.fragments, errors: [] };
  const rootType = operation.kind === 'mutation' ? 'Mutation' : 'Query';
  const root: Record<string, unknown> = { __typename: rootType };
  const data = executeSelections(operation.selections, root, state);
  const out: Record<string, unknown> = { data };
  if (state.errors.length > 0) out.errors = state.errors;
  return out;
}

function executeRequest(body: unknown, ctx: GqlCtx): Record<string, unknown> {
  const operation = (body ?? {}) as Record<string, unknown>;
  const query = typeof operation.query === 'string' ? operation.query : '';
  const variables = (operation.variables ?? {}) as Record<string, unknown>;
  const operationName = typeof operation.operationName === 'string' ? operation.operationName : null;
  let document: Document;
  try {
    document = parseDocument(query);
  } catch (err) {
    return { data: null, errors: [{ message: (err as Error).message }] };
  }
  if (document.operations.length === 0) {
    return { data: null, errors: [{ message: 'No operations in the document.' }] };
  }
  let chosen: Operation | undefined;
  if (operationName !== null) {
    chosen = document.operations.find((op) => op.name === operationName);
    if (chosen === undefined) return { data: null, errors: [{ message: `Unknown operation named "${operationName}".` }] };
  } else if (document.operations.length === 1) {
    chosen = document.operations[0];
  } else {
    return { data: null, errors: [{ message: 'Must provide operation name if query contains multiple operations.' }] };
  }
  return executeOperation(chosen, document, ctx, variables);
}

// ---------------------------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------------------------

/** POST /api/graphql — one operation object, or a JSON array of them (batching). */
export function handleGraphql(ctx: Ctx, store: Store): void {
  if (requireAuth(ctx) === null) return;
  let body: unknown;
  try {
    body = ctx.body === null || ctx.body.length === 0 ? null : JSON.parse(ctx.body.toString('utf8'));
  } catch {
    sendJson(ctx, 400, { errors: [{ message: 'Request body is not valid JSON.' }] });
    return;
  }
  const gqlCtx: GqlCtx = { store };
  if (Array.isArray(body)) {
    const results = body.map((entry) => executeRequest(entry, gqlCtx));
    sendJson(ctx, 200, results);
    return;
  }
  sendJson(ctx, 200, executeRequest(body, gqlCtx));
}
