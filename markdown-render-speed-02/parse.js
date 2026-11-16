// Fast dependency-free Markdown renderer matching marked 18.1.3 (default
// options: GFM on, breaks off). Written in this session from the CommonMark
// and GFM specs plus black-box probes of the marked baseline. No caching
// across cases, no input recognition, deterministic output.
//
// Layout: character helpers + escaping, inline scanner, emphasis pass
// (marked's forward-scan algorithm), block parser, renderer.

function isWS(c) { return c === 32 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13; }
function isDigit(c) { return c >= 48 && c <= 57; }
function isAlpha(c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); }
function isAlnum(c) { return isDigit(c) || isAlpha(c); }
function isPunct(c) {
  return (c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126);
}
function isHex(c) { return isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102); }
const RE_PUNCT_U = /[\p{P}\p{S}]/u;
const RE_WS_U = /\s/u;
const RE_ALNUM_U = /[\p{L}\p{N}]/u;
function isPunctCp(cp) {
  if (cp < 128) return isPunct(cp);
  return RE_PUNCT_U.test(String.fromCodePoint(cp));
}
function isWSCp(cp) {
  if (cp < 128) return cp === 32 || cp === 9 || cp === 10 || cp === 11 || cp === 12 || cp === 13;
  return RE_WS_U.test(String.fromCodePoint(cp));
}
function isAlnumCp(cp) {
  if (cp < 128) return isAlnum(cp);
  return RE_ALNUM_U.test(String.fromCodePoint(cp));
}
const RE_OPENQUOTE_U = /^[\p{Pi}\p{Ps}]$/u;
// Is cp an opening quote (marked's openQuote: " ' and Unicode Pi/Ps)?
function isOpenQuoteCp(cp) {
  return cp === 34 || cp === 39 || (cp >= 128 && RE_OPENQUOTE_U.test(String.fromCodePoint(cp)));
}
// marked's RDelim role for a delimiter run, from the chars around it
// (prevCp -1 at start, nextCp -1 at end). 'closer' = groups 1/2 (closer
// only), 'opener' = groups 3/4 (opener only), 'amb' = groups 5/6 (both),
// 'none' = not a delimiter. For '_' there is no group 6, so a '_' run
// between two word chars is 'none'. Punct here is ALL of \p{P}\p{S}
// (including '~'); notPunctSpace is non-space non-punct.
function delimRole(ch, prevCp, nextCp) {
  const prevWS = prevCp !== -1 && isWSCp(prevCp);
  const prevPunct = prevCp !== -1 && isPunctCp(prevCp);
  const prevNPS = prevCp !== -1 && !isWSCp(prevCp) && !isPunctCp(prevCp);
  const prevPS = prevWS || prevPunct;
  const nextWS = nextCp !== -1 && isWSCp(nextCp);
  const nextEnd = nextCp === -1;
  const nextPunct = nextCp !== -1 && isPunctCp(nextCp);
  const nextNPS = nextCp !== -1 && !isWSCp(nextCp) && !isPunctCp(nextCp);
  const nextPS = nextWS || nextPunct;
  if ((prevPunct && (nextWS || nextEnd)) || (prevNPS && (nextPS || nextEnd))) return 'closer';
  if ((prevPS && nextNPS) || (prevWS && nextPunct)) return 'opener';
  if (prevPunct && nextPunct) return 'amb';
  if (ch === '*' && prevNPS && nextNPS) return 'amb';
  return 'none';
}
function cpAt(s, i) {
  if (i < 0 || i >= s.length) return -1;
  return s.codePointAt(i);
}
function cpBefore(s, i) {
  if (i <= 0) return -1;
  const lo = s.charCodeAt(i - 1);
  if (lo >= 0xDC00 && lo <= 0xDFFF && i >= 2) {
    const hi = s.charCodeAt(i - 2);
    if (hi >= 0xD800 && hi <= 0xDBFF) return (hi - 0xD800) * 0x400 + (lo - 0xDC00) + 0x10000;
  }
  return lo;
}

// Escape & < > " ' (every & is escaped).
// marked's ge(): drop trailing blank lines from a matched html-block
// text, but only when there are more than two lines after the last
// non-blank line (so a single trailing newline at EOF is kept).
function geText(a) {
  const e = a.split('\n');
  let t = e.length - 1;
  while (t >= 0 && isBlank(e[t])) t--;
  return e.length - t <= 2 ? a : e.slice(0, t + 1).join('\n');
}
function escapeHtml(s) {
  let out = null, last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let rep = null;
    if (c === 38) rep = '&amp;';
    else if (c === 60) rep = '&lt;';
    else if (c === 62) rep = '&gt;';
    else if (c === 34) rep = '&quot;';
    else if (c === 39) rep = '&#39;';
    if (rep !== null) {
      if (out === null) out = '';
      out += s.slice(last, i) + rep;
      last = i + 1;
    }
  }
  if (out === null) return s;
  return out + s.slice(last);
}
// Escape & < > ' (not ") — fenced-code language names.
function escapeLang(s) {
  let out = null, last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let rep = null;
    if (c === 38) rep = '&amp;';
    else if (c === 60) rep = '&lt;';
    else if (c === 62) rep = '&gt;';
    else if (c === 39) rep = '&#39;';
    if (rep !== null) {
      if (out === null) out = '';
      out += s.slice(last, i) + rep;
      last = i + 1;
    }
  }
  if (out === null) return s;
  return out + s.slice(last);
}
// End index (exclusive) of a syntactically valid entity starting at s[i]=='&',
// or 0. Named: & + word chars + ';'. Numeric: &#digits; or &#xhex;.
function entityEnd(s, i) {
  const n = s.length;
  let j = i + 1;
  if (j < n && s.charCodeAt(j) === 35) {
    j++;
    let hex = false;
    if (j < n && (s.charCodeAt(j) === 120 || s.charCodeAt(j) === 88)) { hex = true; j++; }
    const start = j;
    while (j < n && (hex ? isHex(s.charCodeAt(j)) : isDigit(s.charCodeAt(j)))) j++;
    if (j === start || j >= n || s.charCodeAt(j) !== 59) return 0;
    if (hex ? j - start > 6 : j - start > 7) return 0;
    return j + 1;
  }
  const start = j;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (isAlnum(c) || c === 95) j++;
    else break;
  }
  if (j === start || j >= n || s.charCodeAt(j) !== 59) return 0;
  return j + 1;
}
// Decode an entity starting at s[i]=='&' for text. Returns {end, html} or null.
// Named entities are kept verbatim (marked does not validate names);
// numeric ones decode to the character (U+FFFD for 0, >0x10FFFF, surrogates).
function scanEntity(s, i) {
  const end = entityEnd(s, i);
  if (end === 0) return null;
  if (s.charCodeAt(i + 1) !== 35) return { end, html: s.slice(i, end) };
  const body = s.slice(i + 2, end - 1);
  const hex = body.charCodeAt(0) === 120 || body.charCodeAt(0) === 88;
  const num = parseInt(hex ? body.slice(1) : body, hex ? 16 : 10);
  let ch;
  if (num === 0 || num > 0x10FFFF || (num >= 0xD800 && num <= 0xDFFF)) ch = '\uFFFD';
  else ch = String.fromCodePoint(num);
  return { end, html: escapeHtml(ch) };
}
// Escape an href/src/title attribute: & < > " ' escaped, except a & that
// starts a valid entity reference is kept verbatim.
function escapeAttrEntity(s) {
  let out = null, last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 38) {
      const e = entityEnd(s, i);
      if (e > 0) { i = e - 1; continue; }
      if (out === null) out = '';
      out += s.slice(last, i) + '&amp;';
      last = i + 1;
    } else if (c === 60 || c === 62 || c === 34 || c === 39) {
      const rep = c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;';
      if (out === null) out = '';
      out += s.slice(last, i) + rep;
      last = i + 1;
    }
  }
  if (out === null) return s;
  return out + s.slice(last);
}
// cleanUrl: encodeURI equivalent; returns null for lone surrogates
// (marked then renders the link as plain text).
function cleanUrl(u) {
  let out = null, last = 0;
  for (let i = 0; i < u.length; i++) {
    const c = u.charCodeAt(i);
    let rep = null;
    if (c === 34) rep = '%22';
    else if (c === 32) rep = '%20';
    else if (c === 60) rep = '%3C';
    else if (c === 62) rep = '%3E';
    else if (c === 91) rep = '%5B';
    else if (c === 92) rep = '%5C';
    else if (c === 93) rep = '%5D';
    else if (c === 94) rep = '%5E';
    else if (c === 96) rep = '%60';
    else if (c === 123) rep = '%7B';
    else if (c === 124) rep = '%7C';
    else if (c === 125) rep = '%7D';
    else if (c < 32 || c === 127) rep = '%' + c.toString(16).toUpperCase().padStart(2, '0');
    else if (c > 127) {
      let cp = c, len = 1;
      if (c >= 0xD800 && c <= 0xDBFF) {
        if (i + 1 < u.length) {
          const lo = u.charCodeAt(i + 1);
          if (lo >= 0xDC00 && lo <= 0xDFFF) { cp = (c - 0xD800) * 0x400 + (lo - 0xDC00) + 0x10000; len = 2; }
          else return null;
        } else return null;
      } else if (c >= 0xDC00 && c <= 0xDFFF) return null;
      try { rep = encodeURIComponent(String.fromCodePoint(cp)); }
      catch { return null; }
      if (len === 2) i++;
    }
    if (rep !== null) {
      if (out === null) out = '';
      out += u.slice(last, i) + rep;
      last = i + 1;
    }
  }
  if (out === null) return u;
  return out + u.slice(last);
}
// Remove backslash escapes (\ + ASCII punctuation -> the punctuation).
function processEscapes(s) {
  if (s.indexOf('\\') === -1) return s;
  let out = '', last = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 92 && i + 1 < s.length && isPunct(s.charCodeAt(i + 1))) {
      out += s.slice(last, i) + s[i + 1];
      i++;
      last = i + 1;
    }
  }
  return out + s.slice(last);
}
// Normalize a link label: trim, collapse whitespace runs to single spaces,
// case-fold (with the CommonMark special-case folds).
const LIG = { '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st' };
function normalizeLabel(raw) {
  let start = 0, end = raw.length;
  while (start < end && isWS(raw.charCodeAt(start))) start++;
  while (end > start && isWS(raw.charCodeAt(end - 1))) end--;
  let out = '', last = start, pendingSpace = false;
  for (let i = start; i < end; i++) {
    if (isWS(raw.charCodeAt(i))) {
      if (!pendingSpace) { out += raw.slice(last, i); pendingSpace = true; }
    } else {
      if (pendingSpace) { out += ' '; pendingSpace = false; }
      last = i;
      while (i < end && !isWS(raw.charCodeAt(i))) i++;
      out += raw.slice(last, i);
      last = i;
      i--;
    }
  }
  return out.toLowerCase().replace(/[\u00DF\uFB00-\uFB06\u03C2]/g, ch => ch === '\u00DF' ? 'ss' : ch === '\u03C2' ? '\u03C3' : LIG[ch]);
}

// Block-level HTML tag names that start a type-6 HTML block (CommonMark
// list minus details, dialog, menu, source, which marked does not treat
// as block tags).
const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem meta nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul').split(' '));

// ---------- inline parsing ----------
// Token kinds: 0 text, 1 entity (verbatim html), 2 delimiter (* _ ~),
// 3 code span (full <code> html), 4 raw html tag, 5 link/image/autolink
// (full html, plus plain text for alt), 6 hard break.
// Per-parse inline state (marked's Lexer state): inLink is set by <a> tags
// and suppresses extended autolinks for the rest of the document; inRaw is
// set by pre/script/style/textarea tags and makes text render verbatim.
function makeInlineState() { return { inLink: false, inRaw: false }; }

function scanInline(s, refs, inLink, st) {
  const toks = [];
  const n = s.length;
  let i = 0;
  let textStart = 0;
  // Spans of failed link brackets [...](...) where emphasis inside is
  // suppressed (marked does not form _..._ there when the link fails).
  const noEm = [];
  function flushText(end, raw) {
    if (end > textStart) toks.push({ k: 0, s: s.slice(textStart, end), raw: !!raw });
  }
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 92) { // backslash
      const nc = i + 1 < n ? s.charCodeAt(i + 1) : -1;
      if (nc === 10) { // \ + newline -> hard break
        flushText(i, st.inRaw);
        toks.push({ k: 6 });
        i += 2;
        while (i < n && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
        textStart = i;
        continue;
      }
      if (nc !== -1 && isPunct(nc)) {
        flushText(i, st.inRaw);
        toks.push({ k: 0, s: s[i + 1], raw: st.inRaw });
        i += 2; textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 38 && !st.inRaw) { // & -> entity?
      const ent = scanEntity(s, i);
      if (ent) {
        flushText(i, false);
        toks.push({ k: 1, s: ent.html });
        i = ent.end; textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 96) { // backtick -> code span
      let j = i;
      while (j < n && s.charCodeAt(j) === 96) j++;
      const k = j - i;
      let close = -1, p = j;
      while (p < n) {
        if (s.charCodeAt(p) === 96) {
          let q = p;
          while (q < n && s.charCodeAt(q) === 96) q++;
          if (q - p === k) { close = p; break; }
          p = q;
        } else p++;
      }
      if (close === -1) { i = j; continue; }
      let content = s.slice(j, close);
      if (content.indexOf('\n') !== -1) content = content.split('\n').join(' ');
      if (content.length >= 2 && content.charCodeAt(0) === 32 && content.charCodeAt(content.length - 1) === 32) {
        let hasNonSpace = false;
        for (let t = 1; t < content.length - 1; t++) { if (content.charCodeAt(t) !== 32) { hasNonSpace = true; break; } }
        if (hasNonSpace) content = content.slice(1, -1);
      }
      flushText(i, st.inRaw);
      const esc = escapeHtml(content);
      toks.push({ k: 3, s: '<code>' + esc + '</code>', plain: esc });
      i = close + k; textStart = i;
      continue;
    }
    if (c === 42 || c === 95 || c === 126) { // * _ ~ delimiter run
      let j = i;
      while (j < n && s.charCodeAt(j) === c) j++;
      const len = j - i;
      if (c === 126 && len >= 3) { i = j; continue; } // ~~~+ is literal text
      const prevCp = i > 0 ? cpBefore(s, i) : -1;
      const nextCp = j < n ? s.codePointAt(j) : -1;
      const ch = c === 42 ? '*' : c === 95 ? '_' : '~';
      let role, canOpen;
      if (c === 126) {
        // ~ keeps the flanking rule (del is a 1-2 run): role from
        // canOpen/canClose
        const beforeWS = prevCp === -1 || isWSCp(prevCp), afterWS = nextCp === -1 || isWSCp(nextCp);
        const beforePunct = prevCp !== -1 && isPunctCp(prevCp), afterPunct = nextCp !== -1 && isPunctCp(nextCp);
        const leftFlanking = !afterWS && (!afterPunct || beforeWS || beforePunct);
        const rightFlanking = !beforeWS && (!beforePunct || afterWS || afterPunct);
        canOpen = leftFlanking;
        role = leftFlanking && rightFlanking ? 'amb' : leftFlanking ? 'opener' : rightFlanking ? 'closer' : 'none';
      } else {
        role = delimRole(ch, prevCp, nextCp);
        // marked's LDelim gate: the run must be followed by a non-space
        // char (else all LDelim groups are empty and it cannot open), and
        // d = next char is punctuation; u = prev char is whitespace or
        // punctuation (excl * _)
        const d = nextCp !== -1 && isPunctCp(nextCp);
        const u = prevCp !== -1 && (isWSCp(prevCp) || (isPunctCp(prevCp) && prevCp !== 42 && prevCp !== 95));
        canOpen = nextCp !== -1 && !isWSCp(nextCp) && (!d || prevCp === -1 || u);
        // intra-word _: a _ run followed by a word char, preceded by an
        // alnum, never opens
        if (ch === '_' && nextCp !== -1 && !isWSCp(nextCp) && nextCp !== 95 && prevCp !== -1 && isAlnumCp(prevCp)) canOpen = false;
      }
      const canClose = role === 'closer' || role === 'amb';
      // Inside a failed link's brackets, emphasis is suppressed.
      let inNoEm = false;
      for (let q = 0; q < noEm.length; q++) {
        if (i > noEm[q][0] && i < noEm[q][1]) { inNoEm = true; break; }
      }
      if (inNoEm) { i = j; continue; } // literal text
      if (!canOpen && !canClose) { i = j; continue; } // literal text
      flushText(i, st.inRaw);
      toks.push({ k: 2, ch, len, rem: len, pos: i, pos0: i, runEnd: j, canOpen, canClose, role, openPairs: [], closePairs: [] });
      i = j; textStart = j;
      continue;
    }
    if (c === 60) { // < -> angle autolink, then html tag
      const al = tryAngle(s, i);
      if (al) {
        flushText(i, st.inRaw);
        toks.push(al);
        i = al.end; textStart = i;
        continue;
      }
      const tagEnd = scanTag(s, i, st);
      if (tagEnd > 0) {
        flushText(i, st.inRaw);
        toks.push({ k: 4, s: s.slice(i, tagEnd) });
        i = tagEnd; textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 91 || (c === 33 && i + 1 < n && s.charCodeAt(i + 1) === 91)) { // [ or ![
      const isImg = c === 33;
      const link = tryLink(s, isImg ? i + 1 : i, refs, isImg, st);
      if (link) {
        flushText(i, st.inRaw);
        toks.push(link.token);
        i = link.end; textStart = i;
        continue;
      }
      // Failed link: if the brackets are followed by a '(' with content
      // (a destination attempt), emphasis inside the brackets is
      // suppressed in marked — but only for a flat label (no nested
      // brackets); nested content still parses emphasis/links.
      const be = findBracketEnd(s, isImg ? i + 1 : i);
      if (be > 0 && be + 1 < n && s.charCodeAt(be + 1) === 40 && be + 2 < n && s.charCodeAt(be + 2) !== 41) {
        const inner = s.slice((isImg ? i + 1 : i) + 1, be);
        if (inner.indexOf('[') === -1) noEm.push([isImg ? i + 1 : i, be]);
      }
      i++;
      continue;
    }
    if (c === 119 && !inLink && !st.inLink && s.charCodeAt(i + 1) === 119 && s.charCodeAt(i + 2) === 119 && s.charCodeAt(i + 3) === 46) { // www.
      const prev = i > 0 ? s.charCodeAt(i - 1) : 32;
      if (prev === 32 || prev === 9 || prev === 10 || prev === 40 || prev === 42 || prev === 95 || prev === 126) {
        const w = tryWww(s, i);
        if (w) {
          flushText(i, st.inRaw);
          toks.push(w.token);
          i = w.end; textStart = i;
          continue;
        }
      }
      i++;
      continue;
    }
    if ((c === 104 || c === 72 || c === 102 || c === 70 || c === 109 || c === 120) && !inLink && !st.inLink) { // scheme autolink
      const sc = tryScheme(s, i);
      if (sc) {
        flushText(i, st.inRaw);
        toks.push(sc.token);
        i = sc.end; textStart = i;
        continue;
      }
    }
    if (c === 64 && !inLink && !st.inLink) { // @ -> extended email autolink
      const e = tryEmail(s, i, toks);
      if (e) {
        flushText(e.start, st.inRaw);
        toks.push(e.token);
        i = e.end; textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (c === 10) { // newline: hard break if 2+ spaces precede it in this text run
      let sp = 0, q = i - 1;
      while (q >= textStart && s.charCodeAt(q) === 32) { sp++; q--; }
      if (sp >= 2) {
        flushText(i - sp, st.inRaw);
        toks.push({ k: 6 });
        i++;
        while (i < n && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    i++;
  }
  flushText(n, st.inRaw);
  return toks;
}

// Scan an HTML tag starting at s[i]=='<'. Returns end index or -1.
// Updates st.inLink / st.inRaw for <a> and pre/script/style/textarea tags.
function scanTag(s, i, st) {
  const n = s.length;
  const c1 = i + 1 < n ? s.charCodeAt(i + 1) : -1;
  if (c1 === 33) {
    if (s.charCodeAt(i + 2) === 45 && s.charCodeAt(i + 3) === 45) {
      if (s.charCodeAt(i + 4) === 62) return i + 5;
      if (s.charCodeAt(i + 4) === 45 && s.charCodeAt(i + 5) === 62) return i + 6;
      const end = s.indexOf('-->', i + 4);
      return end === -1 ? -1 : end + 3;
    }
    if (s.charCodeAt(i + 2) === 91) {
      if (s.slice(i + 3, i + 9) === 'CDATA[') {
        const end = s.indexOf(']]>', i + 9);
        return end === -1 ? -1 : end + 3;
      }
      return -1;
    }
    if (s.charCodeAt(i + 2) === 63) {
      const end = s.indexOf('?>', i + 3);
      return end === -1 ? -1 : end + 2;
    }
    if (isAlpha(s.charCodeAt(i + 2))) {
      const end = s.indexOf('>', i + 2);
      return end === -1 ? -1 : end + 1;
    }
    return -1;
  }
  if (c1 === 63) {
    const end = s.indexOf('?>', i + 2);
    return end === -1 ? -1 : end + 2;
  }
  if (c1 === 47) { // closing tag </name>
    let j = i + 2;
    if (j >= n || !isAlpha(s.charCodeAt(j))) return -1;
    while (j < n && (isAlnum(s.charCodeAt(j)) || s.charCodeAt(j) === 45)) j++;
    while (j < n && (s.charCodeAt(j) === 32 || s.charCodeAt(j) === 9)) j++;
    if (j >= n || s.charCodeAt(j) !== 62) return -1;
    const name = s.slice(i + 2, j).trim().toLowerCase();
    if (name === 'a') st.inLink = false;
    if (name === 'pre' || name === 'script' || name === 'style' || name === 'textarea') st.inRaw = false;
    return j + 1;
  }
  if (!isAlpha(c1)) return -1;
  let j = i + 1;
  while (j < n && (isAlnum(s.charCodeAt(j)) || s.charCodeAt(j) === 45)) j++;
  const name = s.slice(i + 1, j).toLowerCase();
  const nameEnd = j; // position just after the tag name
  // attributes: each attribute must be preceded by whitespace (marked's
  // tag regex requires \s+ before every attribute)
  let sawWS = false;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 62) {
      j++;
      if (name === 'a') st.inLink = true;
      if (name === 'pre' || name === 'script' || name === 'style' || name === 'textarea') st.inRaw = true;
      return j;
    }
    if (c === 47 && s.charCodeAt(j + 1) === 62) {
      j += 2;
      // Only a bare <a/> (slash immediately after the name) is
      // self-closing; <a /> / <a href="x"/> still open a link in marked.
      if (name === 'a' && j - 2 !== nameEnd) st.inLink = true;
      return j;
    }
    if (c === 32 || c === 9 || c === 10) { sawWS = true; j++; continue; }
    if (!sawWS) return -1;
    if (isAlpha(c) || c === 95 || c === 58) {
      j++;
      while (j < n) {
        const d = s.charCodeAt(j);
        if (isAlnum(d) || d === 95 || d === 58 || d === 46 || d === 45) j++;
        else break;
      }
      let hadWS = false;
      while (j < n && (s.charCodeAt(j) === 32 || s.charCodeAt(j) === 9 || s.charCodeAt(j) === 10)) { hadWS = true; j++; }
      if (j < n && s.charCodeAt(j) === 61) {
        j++;
        while (j < n && (s.charCodeAt(j) === 32 || s.charCodeAt(j) === 9 || s.charCodeAt(j) === 10)) j++;
        if (j < n && (s.charCodeAt(j) === 34 || s.charCodeAt(j) === 39)) {
          const q = s.charCodeAt(j);
          j++;
          while (j < n && s.charCodeAt(j) !== q) j++;
          if (j >= n) return -1;
          j++;
        } else {
          let ok = false;
          while (j < n) {
            const d = s.charCodeAt(j);
            if (d === 32 || d === 9 || d === 10 || d === 34 || d === 39 || d === 61 || d === 60 || d === 62 || d === 96) break;
            ok = true; j++;
          }
          if (!ok) return -1;
        }
        // a valued attribute ends here: the next attribute needs its own
        // whitespace (the main loop sets sawWS when it sees it)
        sawWS = false;
      } else {
        // valueless attribute: the whitespace after its name counts as
        // the separator before the next attribute
        sawWS = hadWS;
      }
      continue;
    }
    return -1;
  }
  return -1;
}

// Angle autolink <scheme:...> or <email>. Returns token or null.
function tryAngle(s, i) {
  const n = s.length;
  let j = i + 1;
  if (j >= n) return null;
  // scheme: [a-zA-Z][a-zA-Z0-9+.-]{1,31}:
  if (isAlpha(s.charCodeAt(j))) {
    let k = j;
    while (k < n && (isAlnum(s.charCodeAt(k)) || s.charCodeAt(k) === 43 || s.charCodeAt(k) === 46 || s.charCodeAt(k) === 45)) k++;
    if (k - j >= 2 && k - j <= 32 && k < n && s.charCodeAt(k) === 58) {
      let m = k + 1;
      while (m < n) {
        const c = s.charCodeAt(m);
        if (c === 62) {
          const text = s.slice(i + 1, m);
          const href = escapeAttrEntity(cleanUrl(text) ?? text);
          const html = '<a href="' + href + '">' + escapeHtml(text) + '</a>';
          return { k: 5, html, plain: escapeHtml(text), autolink: true, end: m + 1 };
        }
        if (c <= 32 || c === 60) return null;
        m++;
      }
      return null;
    }
  }
  // email: local@domain with at least one dot, not followed by - or _
  let k = j;
  while (k < n) {
    const c = s.charCodeAt(k);
    if (isAlnum(c) || c === 46 || c === 33 || c === 35 || c === 36 || c === 37 || c === 38 || c === 39 || c === 42 || c === 43 || c === 47 || c === 61 || c === 63 || c === 64 || c === 94 || c === 95 || c === 96 || c === 123 || c === 124 || c === 125 || c === 126 || c === 45) k++;
    else break;
  }
  const cand = s.slice(j, k);
  const at = cand.indexOf('@');
  if (at > 0 && k < n && s.charCodeAt(k) === 62) {
    const local = cand.slice(0, at), domain = cand.slice(at + 1);
    if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(domain)) {
      const text = cand;
      const href = escapeAttrEntity('mailto:' + text);
      const html = '<a href="' + href + '">' + escapeHtml(text) + '</a>';
      return { k: 5, html, plain: escapeHtml(text), autolink: true, end: k + 1 };
    }
  }
  return null;
}

// Trim trailing punctuation from an extended autolink (marked's _backpedal):
// keeps runs of non-punctuation, balanced (...) groups, and & not starting
// an entity; drops a trailing punctuation run.
function backpedal(u) {
  let end = 0;
  const n = u.length;
  while (end < n) {
    const c = u.charCodeAt(end);
    if (c === 40) { // (
      const close = u.indexOf(')', end);
      if (close === -1) break;
      end = close + 1;
    } else if (c === 38) { // &
      let k = end + 1;
      while (k < n && isAlnum(u.charCodeAt(k))) k++;
      if (k < n && u.charCodeAt(k) === 59 && k === n - 1) break; // &word; at end
      if (k > end + 1 && k < n && u.charCodeAt(k) === 59) {
        // &word; not at end: the & is consumed only if not entity-like to end
        end++;
      } else end++;
    } else if (c === 33 || c === 63 || c === 46 || c === 44 || c === 58 || c === 59 || c === 42 || c === 95 || c === 39 || c === 34 || c === 126 || c === 41) {
      // punctuation run: consumed only if not at the very end
      let k = end;
      while (k < n && (u.charCodeAt(k) === 33 || u.charCodeAt(k) === 63 || u.charCodeAt(k) === 46 || u.charCodeAt(k) === 44 || u.charCodeAt(k) === 58 || u.charCodeAt(k) === 59 || u.charCodeAt(k) === 42 || u.charCodeAt(k) === 95 || u.charCodeAt(k) === 39 || u.charCodeAt(k) === 34 || u.charCodeAt(k) === 126 || u.charCodeAt(k) === 41)) k++;
      if (k === n) break;
      end = k;
    } else {
      end++;
    }
  }
  return u.slice(0, end);
}
function isEmailLocalChar(c) {
  return isAlnum(c) || c === 46 || c === 33 || c === 35 || c === 36 || c === 37 || c === 38 || c === 39 || c === 42 || c === 43 || c === 47 || c === 61 || c === 63 || c === 94 || c === 95 || c === 96 || c === 123 || c === 124 || c === 125 || c === 126 || c === 45;
}
// Extended autolink: scheme://... (http/https/ftp only), or mailto:/xmpp:
// (lowercase only) followed by an email, with an optional /resource for
// xmpp. The mailto:/xmpp: form needs a non-alnum char before it.
function tryScheme(s, i) {
  const n = s.length;
  if (s.slice(i, i + 7) === 'mailto:' || s.slice(i, i + 5) === 'xmpp:') {
    const isMailto = s.charCodeAt(i) === 109;
    const prev = i > 0 ? s.charCodeAt(i - 1) : -1;
    if (prev !== -1 && isAlnum(prev)) return null;
    const at = s.indexOf('@', i);
    if (at === -1) return null;
    const em = /^[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/.exec(s.slice(i + (isMailto ? 7 : 5)));
    if (!em) return null;
    let end = i + (isMailto ? 7 : 5) + em[0].length;
    if (!isMailto) {
      // xmpp may carry one /resource of [A-Za-z0-9@.]+
      if (end < n && s.charCodeAt(end) === 47) {
        let r = end + 1;
        while (r < n) {
          const c = s.charCodeAt(r);
          if (isAlnum(c) || c === 64 || c === 46) r++;
          else break;
        }
        if (r > end + 1) end = r;
      }
    }
    const url = s.slice(i, end);
    const href = escapeAttrEntity(cleanUrl(url) ?? url);
    const html = '<a href="' + href + '">' + escapeHtml(url) + '</a>';
    return { token: { k: 5, html, plain: escapeHtml(url), autolink: true, end }, end };
  }
  let j = i;
  while (j < n && isAlpha(s.charCodeAt(j))) j++;
  const scheme = s.slice(i, j).toLowerCase();
  if (scheme !== 'http' && scheme !== 'https' && scheme !== 'ftp') return null;
  if (s.charCodeAt(j) !== 58 || s.charCodeAt(j + 1) !== 47 || s.charCodeAt(j + 2) !== 47) return null;
  let m = j + 3;
  while (m < n) {
    const c = s.charCodeAt(m);
    if (c <= 32 || c === 60) break;
    m++;
  }
  let url = backpedal(s.slice(i, m));
  if (url.length === 0) return null;
  const cleaned = cleanUrl(url);
  if (cleaned === null) return null;
  const href = escapeAttrEntity(cleaned);
  const html = '<a href="' + href + '">' + escapeHtml(url) + '</a>';
  return { token: { k: 5, html, plain: escapeHtml(url), autolink: true, end: i + url.length }, end: i + url.length };
}
// Extended autolink: www....
function tryWww(s, i) {
  const n = s.length;
  let m = i + 4;
  while (m < n) {
    const c = s.charCodeAt(m);
    if (c <= 32 || c === 60) break;
    m++;
  }
  let url = backpedal(s.slice(i, m));
  if (url.length === 0) return null;
  // must look like a domain: a dot after 'www.' plus at least one char
  const dot = url.indexOf('.', 4);
  if (dot <= 4) return null;
  const cleaned = cleanUrl('http://' + url);
  if (cleaned === null) return null;
  const href = escapeAttrEntity(cleaned);
  const html = '<a href="' + href + '">' + escapeHtml(url) + '</a>';
  return { token: { k: 5, html, plain: escapeHtml(url), autolink: true, end: i + url.length }, end: i + url.length };
}
// Extended email autolink at s[i]=='@'. Scans back for the local part.
// Marked's email regex (It): local [A-Za-z0-9._+-]+, domain
// [a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+, and the char after the
// domain must not be a word char or '-'.
function tryEmail(s, i, toks) {
  const n = s.length;
  let start = i;
  while (start > 0) {
    const c = s.charCodeAt(start - 1);
    if (isAlnum(c) || c === 46 || c === 95 || c === 43 || c === 45) start--;
    else break;
  }
  if (start === i) return null;
  // a backslash escape breaks the local part (an odd run of backslashes
  // before it means its first char is escaped, so no autolink forms)
  if (start > 0) {
    let bs = 0, q = start - 1;
    while (q >= 0 && s.charCodeAt(q) === 92) { bs++; q--; }
    if (bs % 2 === 1) return null;
  }
  const dm = /^[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+/.exec(s.slice(i + 1));
  if (!dm) return null;
  let m = i + 1 + dm[0].length;
  // char after the domain must not be a word char or '-'; marked's regex
  // backtracks the domain to an earlier '.' segment when it is. But a
  // trailing * / _ run that closes an emphasis pair opened earlier in
  // this text is not part of the domain (marked parses the pair's content
  // without the delimiters), so the full domain links.
  if (m < n) {
    const nc = s.charCodeAt(m);
    if (isAlnum(nc) || nc === 95 || nc === 45) {
      if ((nc === 95 || nc === 42) && toks) {
        const ch = nc === 95 ? '_' : '*';
        let hasOpener = false;
        for (let t = 0; t < toks.length; t++) {
          const tk = toks[t];
          if (tk.k === 2 && tk.ch === ch && tk.canOpen) { hasOpener = true; break; }
        }
        if (!hasOpener) {
          const lastDot = dm[0].lastIndexOf('.');
          // truncated domain must still contain a dot, else no match
          if (lastDot <= 0 || dm[0].slice(0, lastDot).indexOf('.') === -1) return null;
          m = i + 1 + lastDot;
        }
      } else {
        const lastDot = dm[0].lastIndexOf('.');
        if (lastDot <= 0 || dm[0].slice(0, lastDot).indexOf('.') === -1) return null;
        m = i + 1 + lastDot;
      }
    }
  }
  const text = s.slice(start, m);
  const href = escapeAttrEntity('mailto:' + text);
  const html = '<a href="' + href + '">' + escapeHtml(text) + '</a>';
  return { start, token: { k: 5, html, plain: escapeHtml(text), autolink: true, end: m }, end: m };
}

// Parse a link title starting at text[r] ('"' or '\'' or '(').
// Returns {title, end} or null.
function parseTitle(text, r) {
  const n = text.length;
  const open = text.charCodeAt(r);
  if (open === 34 || open === 39) {
    let q = r + 1;
    while (q < n) {
      const c = text.charCodeAt(q);
      if (c === 92) {
        const nc = q + 1 < n ? text.charCodeAt(q + 1) : -1;
        if (nc !== -1 && isPunct(nc)) { q += 2; continue; }
        q++;
        continue;
      }
      if (c === open) return { title: processEscapes(text.slice(r + 1, q)), end: q + 1 };
      q++;
    }
    return null;
  }
  let q = r + 1;
  let depth = 1;
  while (q < n) {
    const c = text.charCodeAt(q);
    if (c === 92) {
      const nc = q + 1 < n ? text.charCodeAt(q + 1) : -1;
      if (nc !== -1 && isPunct(nc)) { q += 2; continue; }
      q++;
      continue;
    }
    if (c === 40) { depth++; q++; continue; }
    if (c === 41) {
      depth--;
      if (depth === 0) return { title: processEscapes(text.slice(r + 1, q)), end: q + 1 };
      q++;
      continue;
    }
    q++;
  }
  return null;
}
// Parse an inline link destination starting at s[k]=='('.
// Returns {dest, title, end} or null.
function parseInlineDest(s, k) {
  const n = s.length;
  let j = k + 1;
  while (j < n && isWS(s.charCodeAt(j))) j++;
  if (j >= n) return null;
  let dest;
  if (s.charCodeAt(j) === 60) {
    let m = j + 1, dEnd = -1;
    while (m < n) {
      const c = s.charCodeAt(m);
      if (c === 10) return null;
      if (c === 92) {
        const nc = m + 1 < n ? s.charCodeAt(m + 1) : -1;
        if (nc !== -1 && isPunct(nc)) { m += 2; continue; }
        m++;
        continue;
      }
      if (c === 62) { dEnd = m; break; }
      if (c === 60) return null;
      m++;
    }
    if (dEnd === -1) return null;
    dest = processEscapes(s.slice(j + 1, dEnd));
    j = dEnd + 1;
  } else {
    let m = j, depth = 0;
    while (m < n) {
      const c = s.charCodeAt(m);
      if (c <= 32 || c === 127) break;
      if (c === 92) {
        const nc = m + 1 < n ? s.charCodeAt(m + 1) : -1;
        if (nc !== -1 && isPunct(nc)) { m += 2; continue; }
        m++;
        continue;
      }
      if (c === 40) { depth++; m++; continue; }
      if (c === 41) {
        if (depth === 0) break;
        depth--; m++; continue;
      }
      m++;
    }
    if (depth !== 0) return null;
    dest = processEscapes(s.slice(j, m));
    j = m;
  }
  let q2 = j;
  while (q2 < n && isWS(s.charCodeAt(q2))) q2++;
  let title = null;
  if (q2 < n) {
    const tc = s.charCodeAt(q2);
    if (tc === 34 || tc === 39 || tc === 40) {
      const t = parseTitle(s, q2);
      if (!t) return null;
      title = t.title;
      let q3 = t.end;
      while (q3 < n && isWS(s.charCodeAt(q3))) q3++;
      if (q3 >= n || s.charCodeAt(q3) !== 41) return null;
      return { dest, title, end: q3 + 1 };
    }
  }
  while (j < n && isWS(s.charCodeAt(j))) j++;
  if (j >= n || s.charCodeAt(j) !== 41) return null;
  return { dest, title: null, end: j + 1 };
}
// Scan a nested [...] pair starting at s[j]=='['. Depth 2 allows one more
// nested pair inside (marked's label regex). Returns end index (after ']')
// or -1. Also handles code spans per marked's label regex.
function scanNestedPair(s, j, depth) {
  const n = s.length;
  let p = j + 1;
  while (p < n) {
    const c = s.charCodeAt(p);
    if (c === 92) { p += 2; continue; }
    if (c === 96) {
      const r = skipLabelCode(s, p);
      if (r < 0) return -1;
      p = r;
      continue;
    }
    if (c === 91) {
      if (depth >= 2) return -1;
      const r = scanNestedPair(s, p, depth + 1);
      if (r < 0) return -1;
      p = r;
      continue;
    }
    if (c === 93) return p + 1;
    p++;
  }
  return -1;
}
// At a backtick run starting at s[p], consume marked's label code-span
// alternative (`+ [^`]*? `+) or the `` `+(?=]) `` alternative. Returns the
// index after the consumed span, or -1 if neither matches.
function skipLabelCode(s, p) {
  const n = s.length;
  let j = p;
  while (j < n && s.charCodeAt(j) === 96) j++;
  // `` `+(?=]) `` in marked's label regex is a backtick + `` `+ ``, i.e. a
  // run of 2+ backticks immediately before ']'. A single backtick before
  // ']' cannot use it (cm-525: `[foo`](/uri)` is a code span, no link).
  // The lazy label regex prefers the shortest label, so check this first.
  if (j - p >= 2 && j < n && s.charCodeAt(j) === 93) return j;
  // code span: run, then non-backtick chars, then a backtick run
  let q = j;
  while (q < n && s.charCodeAt(q) !== 96) q++;
  if (q < n) {
    let r = q;
    while (r < n && s.charCodeAt(r) === 96) r++;
    return r;
  }
  // `` `+(?=]) ``: run immediately before ']' (only reached when no
  // closing backtick exists at all)
  if (j - p >= 2 && j < n && s.charCodeAt(j) === 93) return j;
  return -1;
}
// Scan a [...] label starting at s[k]=='[' following marked's label regex.
// Returns {label, end} or null.
// Find the ']' closing the '[' at position i, skipping code spans (by
// run length) and escaped chars, tracking nested brackets. Returns the
// index of ']' or -1. Used only to locate a failed link's bracket span.
function findBracketEnd(s, i) {
  const n = s.length;
  let j = i + 1, depth = 0;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 92) { j += 2; continue; }
    if (c === 96) {
      let k = j;
      while (k < n && s.charCodeAt(k) === 96) k++;
      const run = k - j;
      let p = k, close = -1;
      while (p < n) {
        if (s.charCodeAt(p) === 96) {
          let q = p;
          while (q < n && s.charCodeAt(q) === 96) q++;
          if (q - p === run) { close = p; break; }
          p = q;
        } else p++;
      }
      if (close === -1) return -1;
      j = close + run;
      continue;
    }
    if (c === 91) { depth++; j++; continue; }
    if (c === 93) {
      if (depth === 0) return j;
      depth--; j++; continue;
    }
    j++;
  }
  return -1;
}

function scanLabel(s, k) {
  const n = s.length;
  let j = k + 1;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 92) {
      const nc = j + 1 < n ? s.charCodeAt(j + 1) : -1;
      if (nc !== -1 && isPunct(nc)) { j += 2; continue; }
      j++;
      continue;
    }
    if (c === 96) {
      const r = skipLabelCode(s, j);
      if (r < 0) return null;
      j = r;
      continue;
    }
    if (c === 91) {
      const r = scanNestedPair(s, j, 1);
      if (r < 0) return null;
      j = r;
      continue;
    }
    if (c === 60) {
      // a '<' starts an HTML tag or autolink: skip over it so a ']' inside
      // it does not close the label (marked's link text may contain tags)
      const dummy = makeInlineState();
      const al = tryAngle(s, j);
      if (al) { j = al.end; continue; }
      const te = scanTag(s, j, dummy);
      if (te > 0) { j = te; continue; }
      j++;
      continue;
    }
    if (c === 93) return { label: s.slice(k + 1, j), end: j + 1 };
    j++;
  }
  return null;
}
// Scan a link-reference-definition / reference label (marked's `le`):
// no nested brackets, no code spans, a newline only when not followed by
// a blank line, and never starting with whitespace followed by ']'.
function scanDefLabel(s, k) {
  const n = s.length;
  let j = k + 1;
  // (?!\s*\]) guard
  let q = j;
  while (q < n && (s.charCodeAt(q) === 32 || s.charCodeAt(q) === 9 || s.charCodeAt(q) === 10)) q++;
  if (q < n && s.charCodeAt(q) === 93) return null;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 92) {
      const nc = j + 1 < n ? s.charCodeAt(j + 1) : -1;
      if (nc !== -1) { j += 2; continue; }
      j++;
      continue;
    }
    if (c === 91 || c === 93) {
      if (c === 93) return { label: s.slice(k + 1, j), end: j + 1 };
      return null;
    }
    if (c === 10) {
      // newline allowed only when not followed by a blank line
      let r = j + 1;
      while (r < n && (s.charCodeAt(r) === 32 || s.charCodeAt(r) === 9)) r++;
      if (r >= n || s.charCodeAt(r) === 10) return null;
      j++;
      continue;
    }
    j++;
  }
  return null;
}

// Try to parse a link/image starting at s[i]=='['. Returns {token, end} or null.
function tryLink(s, i, refs, isImg, st) {
  const n = s.length;
  const lab = scanLabel(s, i);
  if (!lab) return null;
  const text = lab.label;
  const close = lab.end - 1;
  let dest = null, title = null, end = -1;
  const k = lab.end;
  if (k < n && s.charCodeAt(k) === 40) {
    const res = parseInlineDest(s, k);
    if (res) { dest = res.dest; title = res.title; end = res.end; }
  }
  if (dest === null) {
    let hadLabel = false;
    if (k < n && s.charCodeAt(k) === 91) {
      let lab2 = null;
      if (s.charCodeAt(k + 1) === 93) lab2 = { label: '', end: k + 2 };
      else lab2 = scanDefLabel(s, k);
      if (lab2) {
        hadLabel = true;
        const key = normalizeLabel(lab2.label === '' ? text : lab2.label);
        const ref = refs.get(key);
        if (ref) { dest = ref.href; title = ref.title; end = lab2.end; }
      }
    }
    if (dest === null && !hadLabel) {
      // shortcut reference: the ref is the link text, but only when the
      // text itself is a valid `le` label (no nested brackets)
      const dl = scanDefLabel(s, i);
      if (dl) {
        const ref = refs.get(normalizeLabel(dl.label));
        if (ref) { dest = ref.href; title = ref.title; end = close + 1; }
      }
    }
  }
  if (dest === null) return null;
  const childToks = scanInline(text, refs, true, st);
  if (!isImg) {
    for (let t = 0; t < childToks.length; t++) {
      if (childToks[t].k === 5 && !childToks[t].isImg && !childToks[t].autolink) return null;
    }
  }
  resolveEmphasis(childToks, text);
  const plain = renderPlain(childToks);
  const cleaned = cleanUrl(dest);
  if (isImg) {
    const src = cleaned === null ? '' : escapeAttrEntity(cleaned);
    const titleAttr = title !== null ? ' title="' + escapeAttrEntity(title) + '"' : '';
    const html = '<img src="' + src + '" alt="' + plain + '"' + titleAttr + '>';
    return { token: { k: 5, href: src, title: null, html, isImg: true, plain, autolink: false, end }, end };
  }
  if (cleaned === null) {
    // invalid URL: marked renders the link text only
    return { token: { k: 0, s: renderTokens(childToks), raw: false, end }, end };
  }
  const html = renderTokens(childToks);
  const href = escapeAttrEntity(cleaned);
  const titleAttr = title !== null ? ' title="' + escapeAttrEntity(title) + '"' : '';
  const full = '<a href="' + href + '"' + titleAttr + '>' + html + '</a>';
  return { token: { k: 5, href, title: null, html: full, isImg: false, plain, autolink: false, end }, end };
}

// ---------- emphasis (marked's forward-scan algorithm) ----------
// Is the delimiter token at tj inside a __...__ span (a '*' run between
// two '_' runs of length >= 2 with no other delimiter between them)?
// Marked's RDelim alt 1 skips such a '*' when scanning for a closer, so
// it must not add to m nor serve as a closer for an outer '*' opener.
function insideUnderscorePair(toks, ti, tj, limit) {
  // marked's RDelim alt 1 skips a '*' that lies between the opener and
  // the closer of one __...__ pair. The nearest '_' run before it must
  // be an opener and the nearest one after it a closer; a closing '__'
  // before it (or an opening '__' after it from a different pair) does
  // not count.
  let before = -1;
  for (let k = tj - 1; k > ti; k--) {
    if (toks[k].k !== 2) continue;
    if (toks[k].ch === '_' && toks[k].len >= 2 && toks[k].rem > 0 && (toks[k].role === 'opener' || toks[k].role === 'amb')) before = k;
    break;
  }
  if (before === -1) return false;
  for (let k = tj + 1; k < limit; k++) {
    if (toks[k].k !== 2) continue;
    if (toks[k].ch === '_' && toks[k].len >= 2 && toks[k].rem > 0 && (toks[k].role === 'closer' || toks[k].role === 'amb')) return true;
    break;
  }
  return false;
}

// For an opener delimiter token D, find its closer by scanning forward
// through same-char delimiter tokens, maintaining marked's m/f accounting:
// opener-only runs add to m, ambiguous runs may be skipped into f by the
// rule-of-3 check (y%3 && (y+b)%3==0), plain closers consume m; the pair
// forms only when m drops to <= 0. Returns {closer, closerIdx, use} or null.
// Marked's emStrong masking (#n): before tokenizing inline text it builds
// a masked copy (blockSkip + anyPunctuationOutsideCode) and computes the
// last possible closer index per delimiter char (fe). A delimiter run can
// only close an emphasis pair if its position is <= that index; a run inside
// a masked span (e.g. a [...](...) that the blockSkip regex spans across
// because of an unmatched backtick run in its label) can never close.
const ANYPUNCT_OUTSIDE_CODE_RE = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
const BLOCKSKIP_RE = /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)|(?<!`)()(?<b>`+)[^`]+\k<b>(?!`)|<(?! )[^<>]*?>/g;
// Cheap detector for the only case where marked's #n masking can change an
// emphasis outcome: a backtick run inside a [...] label with no closing run
// of the same length before the ']' (an "unmatched" run). Then blockSkip
// spans the label across a later '](...)' and masks any '*'/'_' inside.
// Normal links, code spans and tags contain no delimiter tokens in the
// outer token list, so they need no masking. Simple char scan, no regex.
function maySpan(s) {
  const n = s.length;
  let i = 0;
  while (i < n) {
    if (s.charCodeAt(i) === 91) {
      let j = i + 1;
      while (j < n && s.charCodeAt(j) !== 93) {
        if (s.charCodeAt(j) === 96) {
          let k = j;
          while (k < n && s.charCodeAt(k) === 96) k++;
          const runLen = k - j;
          let m = k, found = false;
          while (m < n && s.charCodeAt(m) !== 93) {
            if (s.charCodeAt(m) === 96) {
              let q = m;
              while (q < n && s.charCodeAt(q) === 96) q++;
              if (q - m === runLen) { found = true; break; }
              m = q;
            } else m++;
          }
          if (!found) return true;
          j = k;
        } else j++;
      }
      i = j;
    } else i++;
  }
  return false;
}

function maskInlineText(e) {
  // Marked's #n applies anyPunctuationOutsideCode first, then blockSkip;
  // the passes interact (anyPunct rewrites backticks that blockSkip's
  // label/code-span patterns then see), so both are needed. Guards skip a
  // pass when it cannot match anything.
  let t = e;
  if (t.indexOf('`') !== -1 || t.indexOf('\\') !== -1) {
    t = t.replace(ANYPUNCT_OUTSIDE_CODE_RE, (n, s, r) => r ? '+'.repeat(n.length) : s ? s + n.slice(s.length, -s.length).replace(/`/g, '+') + s : n);
  }
  if (t.indexOf('[') !== -1 || t.indexOf('`') !== -1 || t.indexOf('<') !== -1) {
    t = t.replace(BLOCKSKIP_RE, (n, s, r) => { const o = r ? r.length : 0; return n.slice(0, o) + '[' + 'a'.repeat(n.length - o - 2) + ']'; });
  }
  return t;
}
function lastCloserIdx(masked) {
  const r = { '*': -1, '_': -1, '~': -1 };
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch !== '*' && ch !== '_' && ch !== '~') continue;
    const prev = i === 0 ? '\n' : masked[i - 1];
    if (prev !== ' ' && prev !== '\t' && prev !== '\n' && prev !== '\r' && prev !== '\f') r[ch] = i;
  }
  return r;
}

function findCloser(toks, ti, D, s, R, y, o, limit, lastCloser, masked) {
  let m = Math.min(D.tryLen, D.rem), f = 0;
  const hi = limit === undefined ? toks.length : limit;
  for (let tj = ti + 1; tj < hi; tj++) {
    const C = toks[tj];
    if (C.k !== 2 || C.ch !== D.ch || C.rem <= 0) continue;
    if (C.ch === '~' && C.rem !== D.rem) continue;
    // marked's fe gate: a closer past the last possible closer index for
    // this delimiter char (on the masked text) can never close
    if (lastCloser && C.pos0 > lastCloser[D.ch]) continue;
    // marked scans the MASKED text for closers: a run inside a masked
    // span (its char replaced by 'a'/'+') is not a closer at all
    if (masked && masked[C.pos0] !== D.ch) continue;
    // a '*' inside a __...__ span is skipped entirely (marked RDelim
    // alt 1): it neither adds to m nor closes an outer '*'
    if (D.ch === '*' && insideUnderscorePair(toks, ti, tj, hi)) continue;
    const b = C.rem;
    const role = C.role;
    if (role === 'none') continue;
    if (role === 'opener') { m += b; continue; }
    if (role === 'amb' || R) {
      if (o && role === 'amb') return null;
      if (y % 3 !== 0 && (y + b) % 3 === 0) { f += b; continue; }
    }
    m -= b;
    if (m > 0) continue;
    const usable = Math.min(b, b + m + f);
    const use = (Math.min(D.rem, usable) % 2 === 1) ? 1 : 2;
    return { closer: C, closerIdx: tj, use, usable };
  }
  return null;
}

// Resolve emphasis/del delimiters in a token list, in place.
// Operates left to right like marked: each opener is tried once (with
// char-by-char retry on failure); a failed opener never pairs later.
// A delimiter inside a formed pair may only pair with a closer inside
// that pair (marked re-parses the pair's inner text on its own), so the
// closer search is limited to the innermost enclosing pair's closer.
function resolveEmphasis(toks, s) {
  // Masking (two regex passes over the text) is only needed when there is
  // an emphasis opener to resolve; most paragraphs have none.
  let masked = null, lastCloser = null;
  const stack = [];
  for (let ti = 0; ti < toks.length; ti++) {
    while (stack.length > 0 && ti >= stack[stack.length - 1]) stack.pop();
    const D = toks[ti];
    if (D.k !== 2 || !D.canOpen || D.rem <= 0) continue;
    if (masked === null) {
      // Only run the expensive masking when a spanning blockSkip match is
      // possible (unmatched backtick run in a [...] label); otherwise the
      // masked text equals the original for emphasis purposes.
      masked = maySpan(s) ? maskInlineText(s) : s;
      lastCloser = lastCloserIdx(masked);
    }
    // marked's R flag: prev char is non-whitespace, and (the char after
    // the opener is punct (excl ~, not an open quote), or (for *) the
    // prev char is not whitespace/punct)
    const prevCp = D.pos0 > 0 ? cpBefore(s, D.pos0) : -1;
    const nextCp = D.runEnd < s.length ? s.codePointAt(D.runEnd) : -1;
    const d = nextCp !== -1 && isPunctCp(nextCp);
    const h = prevCp !== -1 && (isWSCp(prevCp) || isPunctCp(prevCp));
    const R = prevCp !== -1 && !isWSCp(prevCp) && (d || (D.ch === '*' && !h));
    const y = D.len;
    const o = prevCp === (D.ch === '*' ? 42 : D.ch === '_' ? 95 : 126);
    const limit = stack.length > 0 ? stack[stack.length - 1] + 1 : toks.length;
    let tryLen = D.len;
    while (D.rem > 0 && tryLen > 0) {
      D.tryLen = tryLen;
      const res = findCloser(toks, ti, D, s, R, y, o, limit, lastCloser, masked);
      if (!res) { tryLen -= 1; continue; }
      const kind = D.ch === '~' ? 'del' : res.use === 2 ? 'strong' : 'em';
      D.openPairs.push({ kind, use: res.use, closer: res.closer });
      res.closer.closePairs.push({ kind, use: res.use, opener: D });
      D.rem -= res.use;
      // Track the largest usable (chars of the closer run in marked's raw M)
      // across pairs; at render time, maxUsable - totalUse chars are inside
      // the outermost pair's content, the rest are outside.
      if (!res.closer.maxUsable || res.usable > res.closer.maxUsable) res.closer.maxUsable = res.usable;
      res.closer.rem -= res.use;
      stack.push(res.closerIdx);
    }
  }
}

// Render inline tokens to HTML.
function renderTokens(toks) {
  let out = '';
  for (let ti = 0; ti < toks.length; ti++) {
    const t = toks[ti];
    if (t.k === 0) out += t.raw ? t.s : escapeHtml(t.s);
    else if (t.k === 1) out += t.s;
    else if (t.k === 2) {
      // inRem: leftover chars inside the outermost pair's content (before
      // its close tag) = maxUsable - totalUse; the rest of rem is outside.
      const totalUse = t.len - t.rem;
      const inRem = t.maxUsable ? Math.max(0, Math.min(t.rem, t.maxUsable - totalUse)) : 0;
      if (inRem > 0) out += t.ch.repeat(inRem);
      for (let p = t.closePairs.length - 1; p >= 0; p--) {
        const kind = t.closePairs[p].kind;
        out += kind === 'em' ? '</em>' : kind === 'strong' ? '</strong>' : '</del>';
      }
      if (t.rem - inRem > 0) out += t.ch.repeat(t.rem - inRem);
      for (let p = 0; p < t.openPairs.length; p++) {
        const kind = t.openPairs[p].kind;
        out += kind === 'em' ? '<em>' : kind === 'strong' ? '<strong>' : '<del>';
      }
    }
    else if (t.k === 3) out += t.s;
    else if (t.k === 4) out += t.s;
    else if (t.k === 5) out += t.html;
    else if (t.k === 6) out += '<br>';
  }
  return out;
}
// Plain-text rendering of inline tokens (for image alt text).
function renderPlain(toks) {
  let out = '';
  for (let ti = 0; ti < toks.length; ti++) {
    const t = toks[ti];
    if (t.k === 0) out += t.raw ? t.s : escapeHtml(t.s);
    else if (t.k === 1) out += t.s;
    else if (t.k === 2) { if (t.rem > 0) out += t.ch.repeat(t.rem); }
    else if (t.k === 3) out += t.plain;
    else if (t.k === 4) out += escapeHtml(t.s);
    else if (t.k === 5) out += t.plain;
    else if (t.k === 6) out += ' ';
  }
  return out;
}
// Full inline pipeline for a block's text.
function inlineToHtml(text, refs, st) {
  const toks = scanInline(text, refs, false, st);
  resolveEmphasis(toks, text);
  return renderTokens(toks);
}

// ---------- block parsing ----------
function isBlank(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}
function indentOf(s) {
  let col = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 32) col++;
    else if (c === 9) col += 4 - (col % 4);
    else break;
  }
  return col;
}
// Strip up to n columns of leading indent; a tab straddling the boundary
// becomes spaces.
function stripUpTo(s, n) {
  let col = 0, i = 0;
  while (i < s.length && col < n) {
    const c = s.charCodeAt(i);
    if (c === 32) { col++; i++; }
    else if (c === 9) {
      const w = 4 - (col % 4);
      if (col + w <= n) { col += w; i++; }
      else {
        let spaces = col + w - n;
        let j = i + 1;
        let c2 = col + w;
        while (j < s.length) {
          const d = s.charCodeAt(j);
          if (d === 32) { spaces++; c2++; j++; }
          else if (d === 9) { const nx = c2 + 4 - (c2 % 4); spaces += nx - c2; c2 = nx; j++; }
          else break;
        }
        return ' '.repeat(spaces) + s.slice(j);
      }
    }
    else break;
  }
  return s.slice(i);
}
// Strip the first n columns of a line (any characters), expanding a
// straddling tab and following leading tabs to spaces.
function stripCols(s, n) {
  let col = 0, i = 0;
  while (i < s.length && col < n) {
    const c = s.charCodeAt(i);
    if (c === 9) {
      const w = 4 - (col % 4);
      if (col + w <= n) { col += w; i++; }
      else {
        let spaces = col + w - n;
        let j = i + 1;
        let c2 = col + w;
        while (j < s.length) {
          const d = s.charCodeAt(j);
          if (d === 32) { spaces++; c2++; j++; }
          else if (d === 9) { const nx = c2 + 4 - (c2 % 4); spaces += nx - c2; c2 = nx; j++; }
          else break;
        }
        return ' '.repeat(spaces) + s.slice(j);
      }
    } else { col++; i++; }
  }
  return s.slice(i);
}
// Line after stripping its indent (only valid when indent <= 3).
function dedent3(s) {
  const ind = indentOf(s);
  if (ind > 3) return null;
  return stripUpTo(s, ind);
}
function isSetextLine(s) {
  const r = dedent3(s);
  if (r === null || r.length === 0) return 0;
  const c = r.charCodeAt(0);
  if (c !== 61 && c !== 45) return 0;
  let i = 1;
  while (i < r.length && r.charCodeAt(i) === c) i++;
  while (i < r.length && (r.charCodeAt(i) === 32 || r.charCodeAt(i) === 9)) i++;
  if (i !== r.length) return 0;
  return c === 61 ? 1 : 2;
}
// ATX heading: returns {level, content} or null.
function matchATX(line) {
  const ind = indentOf(line);
  if (ind > 3) return null;
  const rest = stripUpTo(line, ind);
  if (rest.charCodeAt(0) !== 35) return null;
  let k = 0;
  while (k < rest.length && rest.charCodeAt(k) === 35) k++;
  if (k > 6) return null;
  if (k < rest.length && rest.charCodeAt(k) !== 32 && rest.charCodeAt(k) !== 9) return null;
  let s = rest.slice(k);
  let b = s.length;
  while (b > 0 && (s.charCodeAt(b - 1) === 32 || s.charCodeAt(b - 1) === 9)) b--;
  s = s.slice(0, b);
  // closing sequence of #'s preceded by space/tab
  let e = s.length;
  while (e > 0 && s.charCodeAt(e - 1) === 35) e--;
  if (e < s.length && e > 0 && (s.charCodeAt(e - 1) === 32 || s.charCodeAt(e - 1) === 9)) {
    s = s.slice(0, e);
    let b2 = s.length;
    while (b2 > 0 && (s.charCodeAt(b2 - 1) === 32 || s.charCodeAt(b2 - 1) === 9)) b2--;
    s = s.slice(0, b2);
  }
  let a = 0;
  while (a < s.length && (s.charCodeAt(a) === 32 || s.charCodeAt(a) === 9)) a++;
  return { level: k, content: s.slice(a) };
}
function matchHR(line) {
  const r = dedent3(line);
  if (r === null || r.length === 0) return false;
  const c = r.charCodeAt(0);
  if (c !== 45 && c !== 95 && c !== 42) return false;
  let count = 0, i = 0;
  while (i < r.length) {
    const d = r.charCodeAt(i);
    if (d === c) { count++; i++; }
    else if (d === 32 || d === 9) i++;
    else return false;
  }
  return count >= 3;
}
// Fenced code start: returns {ch, len, info, indent} or null.
function matchFence(line) {
  const ind = indentOf(line);
  if (ind > 3) return null;
  const rest = stripUpTo(line, ind);
  const c = rest.charCodeAt(0);
  if (c !== 96 && c !== 126) return null;
  let k = 0;
  while (k < rest.length && rest.charCodeAt(k) === c) k++;
  if (k < 3) return null;
  const info = rest.slice(k);
  if (c === 96 && info.indexOf('`') !== -1) return null;
  // indentChars: raw count of leading WS chars before the fence (marked's
  // Dt strips by char count, not columns — a tab counts as 1).
  let indentChars = 0;
  while (indentChars < line.length && (line.charCodeAt(indentChars) === 32 || line.charCodeAt(indentChars) === 9)) indentChars++;
  return { ch: c === 96 ? '`' : '~', len: k, info, indent: ind, indentChars };
}
// Is this line a closing fence for the given fence?
function isClosingFence(line, fence) {
  const ind = indentOf(line);
  if (ind > 3) return false;
  const rest = stripUpTo(line, ind);
  let k = 0;
  while (k < rest.length && rest.charCodeAt(k) === fence.ch.charCodeAt(0)) k++;
  if (k < fence.len) return false;
  let i = k;
  while (i < rest.length && (rest.charCodeAt(i) === 32 || rest.charCodeAt(i) === 9)) i++;
  return i === rest.length;
}
// List marker: returns {ordered, bullet, num, delim, markerLen, contentIndent, contentStart} or null.
function matchListMarker(line) {
  const ind = indentOf(line);
  if (ind > 3) return null;
  const rest = stripUpTo(line, ind);
  const n = rest.length;
  if (n === 0) return null;
  const c0 = rest.charCodeAt(0);
  let ordered = false, num = 0, markerLen = 0, delim = '';
  if (c0 === 42 || c0 === 45 || c0 === 43) {
    markerLen = 1;
    delim = String.fromCharCode(c0);
  } else if (isDigit(c0)) {
    let k = 0;
    while (k < n && isDigit(rest.charCodeAt(k))) k++;
    if (k > 9) return null;
    const d = rest.charCodeAt(k);
    if (d !== 46 && d !== 41) return null;
    num = parseInt(rest.slice(0, k), 10);
    if (num > 999999999) return null;
    ordered = true;
    markerLen = k + 1;
    delim = String.fromCharCode(d);
  } else return null;
  // a marker must be followed by a space, a tab, or end of line
  if (markerLen < n) {
    const nc = rest.charCodeAt(markerLen);
    if (nc !== 32 && nc !== 9) return null;
  }
  // whitespace after the marker
  let col = ind + markerLen, j = markerLen, w = 0;
  while (j < n) {
    const c = rest.charCodeAt(j);
    if (c === 32) { w++; col++; j++; }
    else if (c === 9) { const tw = 4 - (col % 4); w += tw; col += tw; j++; }
    else break;
  }
  let contentIndent;
  if (j >= n) contentIndent = ind + markerLen + 1;
  else if (w >= 5) contentIndent = ind + markerLen + 1;
  else contentIndent = ind + markerLen + w;
  return { ordered, bullet: ordered ? null : delim, num, delim, markerLen, contentIndent, wsEnd: j, wsCols: w, indent: ind };
}
// First line's content for a list item (marker + whitespace removed, with
// the 5+-spaces rule and tab-straddle handling).
function itemFirstContent(line, m) {
  const ind = indentOf(line);
  const rest = stripUpTo(line, ind);
  if (m.wsEnd >= rest.length) return '';
  if (m.wsCols >= 5) {
    // content indent is marker+1: the remaining (wsCols-1) whitespace
    // columns stay as spaces in front of the non-whitespace remainder
    return ' '.repeat(m.wsCols - 1) + rest.slice(m.wsEnd);
  }
  return rest.slice(m.wsEnd);
}

// HTML block start: returns {type} (1-7) or null. Types 1-6 can interrupt a
// paragraph; type 7 cannot.
function matchHtmlBlock(line) {
  const ind = indentOf(line);
  if (ind > 3) return null;
  const rest = stripUpTo(line, ind);
  if (rest.charCodeAt(0) !== 60) return null;
  const c1 = rest.charCodeAt(1);
  if (c1 === 33) {
    if (rest.charCodeAt(2) === 45 && rest.charCodeAt(3) === 45) return { type: 2 };
    if (rest.charCodeAt(2) === 91 && rest.slice(3, 9) === 'CDATA[') return { type: 5 };
    if (isAlpha(rest.charCodeAt(2))) return { type: 4 };
    return null;
  }
  if (c1 === 63) return { type: 3 };
  if (c1 === 47) {
    let j = 2;
    while (j < rest.length && (isAlnum(rest.charCodeAt(j)) || rest.charCodeAt(j) === 45)) j++;
    const name = rest.slice(2, j).toLowerCase();
    // a closing tag is never type 1 (that is only the opening
    // <pre>/<script>/<style>/<textarea>); pre et al are not block tags,
    // so a closing </pre> falls through to type 7 below
    if (name.length > 0 && BLOCK_TAGS.has(name)) return { type: 6 };
    // type 7: any closing tag alone on the line
    const dummy = makeInlineState();
    const end = scanTag(rest, 0, dummy);
    if (end > 0) {
      let e = end;
      while (e < rest.length && (rest.charCodeAt(e) === 32 || rest.charCodeAt(e) === 9)) e++;
      if (e === rest.length) return { type: 7 };
    }
    return null;
  }
  if (!isAlpha(c1)) return null;
  let j = 1;
  while (j < rest.length && (isAlnum(rest.charCodeAt(j)) || rest.charCodeAt(j) === 45)) j++;
  const name = rest.slice(1, j).toLowerCase();
  if (name === 'pre' || name === 'script' || name === 'style' || name === 'textarea') {
    const nc = rest.charCodeAt(j);
    if (nc === 32 || nc === 9 || nc === 62 || nc === 47 || j >= rest.length) return { type: 1, tag: name };
    return null;
  }
  if (BLOCK_TAGS.has(name)) {
    const nc = rest.charCodeAt(j);
    if (nc === 32 || nc === 9 || nc === 62 || nc === 47 || j >= rest.length) return { type: 6 };
    return null;
  }
  // type 7: a complete open tag alone on the line
  const dummy = makeInlineState();
  const end = scanTag(rest, 0, dummy);
  if (end > 0) {
    let e = end;
    while (e < rest.length && (rest.charCodeAt(e) === 32 || rest.charCodeAt(e) === 9)) e++;
    if (e === rest.length) return { type: 7 };
  }
  return null;
}
// Try to parse a link reference definition at text[pos] (pos at '[').
// Returns {key, href, title, end} or null. end is the index just past the
// definition (at a newline or end of text).
function tryDefAt(text, pos) {
  const n = text.length;
  const lab = scanDefLabel(text, pos);
  if (!lab || lab.label === '') return null;
  let j = lab.end;
  if (j >= n || text.charCodeAt(j) !== 58) return null;
  j++;
  // skip spaces/tabs, optionally one newline + spaces/tabs
  let save = j;
  while (j < n && (text.charCodeAt(j) === 32 || text.charCodeAt(j) === 9)) j++;
  if (j < n && text.charCodeAt(j) === 10) {
    let k = j + 1;
    while (k < n && (text.charCodeAt(k) === 32 || text.charCodeAt(k) === 9)) k++;
    if (k < n) { j = k; } else return null;
  }
  if (j >= n) return null;
  let dest;
  if (text.charCodeAt(j) === 60) {
    let m = j + 1, dEnd = -1;
    while (m < n) {
      const c = text.charCodeAt(m);
      if (c === 10) return null;
      if (c === 92) {
        const nc = m + 1 < n ? text.charCodeAt(m + 1) : -1;
        if (nc !== -1 && isPunct(nc)) { m += 2; continue; }
        m++;
        continue;
      }
      if (c === 62) { dEnd = m; break; }
      if (c === 60) return null;
      m++;
    }
    if (dEnd === -1) return null;
    dest = processEscapes(text.slice(j + 1, dEnd));
    j = dEnd + 1;
  } else {
    let m = j, depth = 0;
    while (m < n) {
      const c = text.charCodeAt(m);
      if (c <= 32 || c === 127) break;
      if (c === 92) {
        const nc = m + 1 < n ? text.charCodeAt(m + 1) : -1;
        if (nc !== -1 && isPunct(nc)) { m += 2; continue; }
        m++;
        continue;
      }
      if (c === 40) { depth++; m++; continue; }
      if (c === 41) {
        if (depth === 0) break;
        depth--; m++; continue;
      }
      m++;
    }
    if (depth !== 0 || m === j) return null;
    dest = processEscapes(text.slice(j, m));
    j = m;
  }
  // Ending: try a title first (it must follow whitespace), then fall back
  // to no title (the def ends right after the destination).
  let title = null;
  let q = j;
  while (q < n && (text.charCodeAt(q) === 32 || text.charCodeAt(q) === 9)) q++;
  if (q < n) {
    const tc = text.charCodeAt(q);
    if (tc === 34 || tc === 39 || tc === 40) {
      if (q > j) {
        const t = parseTitle(text, q);
        if (t) {
          let e = t.end;
          while (e < n && (text.charCodeAt(e) === 32 || text.charCodeAt(e) === 9)) e++;
          if (e >= n || text.charCodeAt(e) === 10) {
            return { key: normalizeLabel(lab.label), href: dest, title: t.title, end: e };
          }
        }
      } else return null;
    } else if (tc === 10) {
      // title may sit on the next line
      let k = q + 1;
      while (k < n && (text.charCodeAt(k) === 32 || text.charCodeAt(k) === 9)) k++;
      if (k < n) {
        const tc2 = text.charCodeAt(k);
        if (tc2 === 34 || tc2 === 39 || tc2 === 40) {
          const t = parseTitle(text, k);
          if (t) {
            let e = t.end;
            while (e < n && (text.charCodeAt(e) === 32 || text.charCodeAt(e) === 9)) e++;
            if (e >= n || text.charCodeAt(e) === 10) {
              return { key: normalizeLabel(lab.label), href: dest, title: t.title, end: e };
            }
          }
        }
      }
    }
  }
  let e = j;
  while (e < n && (text.charCodeAt(e) === 32 || text.charCodeAt(e) === 9)) e++;
  if (e < n && text.charCodeAt(e) !== 10) return null;
  return { key: normalizeLabel(lab.label), href: dest, title, end: e };
}
// Consume leading link reference definitions from paragraph lines.
// Returns the remaining lines.
function consumeRefDefs(paraLines, refs) {
  let text = paraLines.join('\n');
  let pos = 0;
  let consumed = false;
  for (;;) {
    let p = pos;
    while (p < text.length && (text.charCodeAt(p) === 32 || text.charCodeAt(p) === 9)) p++;
    if (p >= text.length || text.charCodeAt(p) !== 91) break;
    const d = tryDefAt(text, p);
    if (!d) break;
    if (!refs.has(d.key)) refs.set(d.key, { href: d.href, title: d.title });
    consumed = true;
    pos = d.end;
    if (pos < text.length && text.charCodeAt(pos) === 10) pos++;
    else break;
  }
  if (!consumed) return paraLines;
  const rest = text.slice(pos);
  if (rest.length === 0) return [];
  return rest.split('\n');
}
function finalizePara(paraLines, refs) {
  const rest = consumeRefDefs(paraLines, refs);
  if (rest.length === 0) return null;
  return { t: 'para', text: rest.join('\n') };
}
// Split a table row line into cells (split on unescaped |).
function splitTableRow(line, count) {
  let a = 0, b = line.length;
  while (a < b && (line.charCodeAt(a) === 32 || line.charCodeAt(a) === 9)) a++;
  while (b > a && (line.charCodeAt(b - 1) === 32 || line.charCodeAt(b - 1) === 9)) b--;
  const s = line.slice(a, b);
  const cells = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 92) {
      const nc = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
      if (nc !== -1 && isPunct(nc)) { i++; continue; }
    }
    if (c === 124) { cells.push(s.slice(start, i)); start = i + 1; }
  }
  cells.push(s.slice(start));
  if (cells.length > 1 && cells[0].trim() === '') cells.shift();
  if (cells.length > 1 && cells[cells.length - 1].trim() === '') cells.pop();
  for (let i = 0; i < cells.length; i++) {
    const x = cells[i];
    let aa = 0, bb = x.length;
    while (aa < bb && (x.charCodeAt(aa) === 32 || x.charCodeAt(aa) === 9)) aa++;
    while (bb > aa && (x.charCodeAt(bb - 1) === 32 || x.charCodeAt(bb - 1) === 9)) bb--;
    let cell = x.slice(aa, bb);
    if (cell.indexOf('\\|') !== -1) cell = cell.split('\\|').join('|');
    cells[i] = cell;
  }
  // marked's splitCells: pad short rows with '' and drop extra cells
  if (count !== undefined) {
    if (cells.length > count) cells.length = count;
    else while (cells.length < count) cells.push('');
  }
  return cells;
}
// Parse a table delimiter row. Returns {align, count} or null.
function parseTableDelimiter(line) {
  if (line.indexOf('|') === -1) return null;
  const cells = splitTableRow(line);
  const align = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    let a = 0, b = cell.length, left = false, right = false;
    if (cell.charCodeAt(0) === 58) { left = true; a++; }
    if (cell.length > 0 && cell.charCodeAt(cell.length - 1) === 58) { right = true; b--; }
    if (b - a < 1) return null;
    for (let k = a; k < b; k++) {
      if (cell.charCodeAt(k) !== 45) return null;
    }
    align.push(left && right ? 'center' : left ? 'left' : right ? 'right' : null);
  }
  return { align, count: cells.length };
}
// Does a table body row line end the table? (marked's table regex terminator)
function isTableRowEnd(line) {
  if (/^ *$/.test(line)) return true; // blank (spaces only); tab-only is a row
  if (matchATX(line)) return true;
  if (matchFence(line)) return true;
  const hb = matchHtmlBlock(line);
  if (hb && hb.type <= 6) return true;
  if (matchHR(line)) return true;
  const ind = indentOf(line);
  if (ind <= 3) {
    const rest = stripUpTo(line, ind);
    if (rest.charCodeAt(0) === 62) return true;
  }
  if (ind >= 4) {
    // indented content ends the table: 4 spaces, or <=3 spaces + a tab,
    // followed by another character (a tab-only line is a row, not an end)
    let j = 0;
    while (j < line.length && line.charCodeAt(j) === 32 && j < 4) j++;
    if (j === 4) { if (j < line.length) return true; }
    let k = 0;
    while (k < line.length && line.charCodeAt(k) === 32 && k < 3) k++;
    if (k < line.length && line.charCodeAt(k) === 9) {
      if (k + 1 < line.length) return true;
    }
  }
  const m = matchListMarker(line);
  if (m && m.wsCols > 0) {
    if (!m.ordered) return true;
    if (m.num === 1) return true;
  }
  return false;
}

// Expand the leading spaces/tabs of a line to spaces (a tab advances to
// the next multiple of 4 from the line start). Used when dedenting a list
// continuation line: marked expands the leading whitespace first (its
// `Z`), then slices off the item indent, so a tab's width is fixed by its
// original column.
function expandLeadingWS(line) {
  let i = 0, col = 0, out = '';
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 32) { out += ' '; col++; i++; }
    else if (c === 9) { const w = 4 - (col % 4); out += ' '.repeat(w); col += w; i++; }
    else break;
  }
  return out + line.slice(i);
}
// Parse a fenced code block starting at lines[i]. Returns {node, next}.
function parseFence(lines, i, fence) {
  const content = [];
  let j = i + 1;
  // marked's Dt (indentCodeCompensation /^(\s+)(?:```)/) applies ONLY to
  // backtick fences: strip up to fence.indentChars leading-WS chars from
  // each content line (char count, so a tab counts as 1, not 4 columns).
  // Tilde fences keep their content lines as-is.
  const strip = fence.ch === '`' ? (fence.indentChars !== undefined ? fence.indentChars : fence.indent) : 0;
  while (j < lines.length) {
    const line = lines[j];
    if (isClosingFence(line, fence)) { j++; break; }
    let w = 0;
    while (w < line.length && (line.charCodeAt(w) === 32 || line.charCodeAt(w) === 9)) w++;
    content.push(line.slice(Math.min(w, strip)));
    j++;
  }
  let text = content.join('\n');
  return { node: { t: 'code', lang: processEscapes(fence.info.trim().split(/[ \t]/)[0] || '') || null, text }, next: j };
}
// Parse an HTML block starting at lines[i]. Returns {node, next}.
function parseHtmlBlock(lines, i, hb) {
  const content = [];
  let j = i;
  const endRe = hb.type === 1 ? new RegExp('</' + hb.tag + '\\s*>', 'i')
    : hb.type === 2 ? /-->/ : hb.type === 3 ? /\?>/ : hb.type === 4 ? />/ : hb.type === 5 ? /\]\]>/ : null;
  while (j < lines.length) {
    const line = lines[j];
    content.push(line);
    j++;
    if (endRe) {
      if (endRe.test(line)) break;
    } else {
      if (j < lines.length && isBlank(lines[j])) break;
    }
  }
  return { node: { t: 'html', lines: content }, next: j };
}
// Parse an indented code block starting at lines[i]. Returns {node, next}.
function parseIndentedCode(lines, i) {
  const content = [];
  let j = i, lastNonBlank = i;
  while (j < lines.length) {
    const line = lines[j];
    if (isBlank(line)) { content.push(stripUpTo(line, 4)); j++; continue; }
    if (indentOf(line) >= 4) { content.push(stripUpTo(line, 4)); j++; lastNonBlank = j; continue; }
    break;
  }
  content.length = lastNonBlank - i;
  const text = content.join('\n');
  return { node: { t: 'code', lang: null, text }, next: lastNonBlank };
}
// Does the line start a block that can interrupt a paragraph?
function canInterrupt(line) {
  if (matchATX(line)) return true;
  if (matchFence(line)) return true;
  const hb = matchHtmlBlock(line);
  if (hb && hb.type <= 6) return true;
  if (matchHR(line)) return true;
  const ind = indentOf(line);
  if (ind <= 3) {
    const rest = stripUpTo(line, ind);
    if (rest.charCodeAt(0) === 62) return true;
  }
  const m = matchListMarker(line);
  if (m) {
    if (itemFirstContent(line, m).length === 0) return false;
    if (!m.ordered) return true;
    return m.num === 1;
  }
  return false;
}
// Does the line start any block (used for lazy-continuation decisions)?
function isBlockStartForLazy(line) {
  if (matchATX(line)) return true;
  if (matchFence(line)) return true;
  const hb = matchHtmlBlock(line);
  if (hb && hb.type <= 6) return true;
  if (matchHR(line)) return true;
  const ind = indentOf(line);
  if (ind <= 3) {
    const rest = stripUpTo(line, ind);
    if (rest.charCodeAt(0) === 62) return true;
  }
  if (matchListMarker(line)) return true;
  return false;
}
// After processing this container-relative line, is a paragraph open?
function paraOpenAfterLine(line, paraOpen) {
  if (isBlank(line)) return false;
  if (line === '') return false;
  const st = isSetextLine(line);
  if (st === 2) return false;
  if (st === 1) return paraOpen ? false : true;
  if (matchATX(line)) return false;
  if (matchFence(line)) return false;
  const hb = matchHtmlBlock(line);
  if (hb && hb.type <= 6) return false;
  if (matchHR(line)) return false;
  const ind = indentOf(line);
  if (ind <= 3) {
    const rest = stripUpTo(line, ind);
    if (rest.charCodeAt(0) === 62) return paraOpenAfterLine(stripQuotePrefix(line).rest, paraOpen);
  }
  if (matchListMarker(line)) return false;
  if (!paraOpen && ind >= 4) return false;
  if (paraOpen && parseTableDelimiter(line)) return false;
  return true;
}
// Strip one blockquote prefix ('>' after <=3 indent + one optional space).
// Returns {rest, cols} or null.
function stripQuotePrefix(line) {
  let col = 0, i = 0;
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 32) { col++; i++; if (col > 3) return null; }
    else if (c === 9) {
      const w = 4 - (col % 4);
      if (col + w > 3) return null;
      col += w; i++;
    }
    else break;
  }
  if (line.charCodeAt(i) !== 62) return null;
  i++; col++;
  // Expand the whole run of spaces/tabs after '>' (marked expands the
  // blockquote marker whitespace fully), then drop one separator char
  // (marked's blockquoteSetextReplace2 removes '>' plus one following
  // space/tab).
  let ws = '';
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 32) { ws += ' '; col++; i++; }
    else if (c === 9) { const w = 4 - (col % 4); ws += ' '.repeat(w); col += w; i++; }
    else break;
  }
  if (ws.length > 0) ws = ws.slice(1);
  return { rest: ws + line.slice(i), cols: col };
}

// Gather a blockquote starting at lines[i]. Returns {node, next}.
function gatherBlockquote(lines, lazyFlags, i, refs, st) {
  const inner = [];
  const lazy = [];
  const groupStart = [];
  let paraOpen = false;
  let prevWasQuote = false;
  let fence = null;
  let j = i;
  while (j < lines.length) {
    const line = lines[j];
    const q = stripQuotePrefix(line);
    if (q) {
      inner.push(q.rest);
      lazy.push(false);
      groupStart.push(false);
      // track an open fenced code block: a lazy line cannot continue it
      if (fence) {
        if (isClosingFence(q.rest, fence)) fence = null;
      } else {
        const f = matchFence(q.rest);
        if (f) fence = f;
      }
      paraOpen = paraOpenAfterLine(q.rest, paraOpen);
      prevWasQuote = true;
      j++;
      continue;
    }
    if (isBlank(line)) {
      // A blank line without a '>' prefix ends the blockquote (a new
      // quote after it is a separate blockquote).
      break;
    }
    // A line without '>' cannot be part of a fenced code block (no lazy
    // continuation for fences), so an open fence ends the quote here.
    if (fence) break;
    // A lazy line is a continuation if a paragraph is open, or if the
    // previous inner line is a list item / blockquote line whose content
    // may hold an open paragraph (marked re-lexes those with the line).
    const lastInner = inner.length > 0 ? inner[inner.length - 1] : null;
    const canAbsorb = paraOpen || (lastInner !== null && (matchListMarker(lastInner) !== null ||
      (indentOf(lastInner) <= 3 && stripUpTo(lastInner, indentOf(lastInner)).charCodeAt(0) === 62)));
    if (canAbsorb && !isBlockStartForLazy(line)) {
      // Lazy continuation: a setext-underline line cannot be a setext
      // underline here, so marked indents it by 4 spaces (it stays
      // paragraph text).
      const st = /^ {0,3}(=+|-+)[ \t]*$/.exec(line);
      inner.push(st ? '    ' + line : line);
      lazy.push(true);
      // a lazy line starts a new lexing group when it directly follows a
      // '>' line (marked lexes it on its own, so an indented one merges
      // into the paragraph with its indent stripped)
      groupStart.push(prevWasQuote);
      paraOpen = paraOpenAfterLine(line, paraOpen);
      prevWasQuote = false;
      j++;
      continue;
    }
    break;
  }
  while (inner.length > 0 && inner[inner.length - 1] === '') { inner.pop(); lazy.pop(); groupStart.pop(); }
  const sub = parseBlocks(inner, refs, st, { lazyFlags: lazy, groupStartFlags: groupStart, top: true, srcEndsWithNL: false });
  return { node: { t: 'quote', blocks: sub.blocks }, next: j };
}
// Parse a list starting at lines[i]. Returns {node, next}.
function parseList(lines, i, refs, st) {
  const first = matchListMarker(lines[i]);
  const ordered = first.ordered;
  const delim = first.delim;
  const bullet = first.bullet;
  const listIndent = first.indent;
  const start = first.num;
  const items = [];
  let loose = false;
  let j = i;
  while (j < lines.length) {
    // marked's list tokenizer stops the list at a thematic break
    if (matchHR(lines[j])) break;
    const m = matchListMarker(lines[j]);
    // sibling items share the type/delimiter and sit within 3 spaces of
    // indent (marked's list-item regex allows 0-3 spaces of indent)
    if (!m || m.ordered !== ordered || m.delim !== delim || m.indent > 3) break;
    // gather this item's lines
    const itemLines = [itemFirstContent(lines[j], m)];
    let paraOpen = paraOpenAfterLine(itemLines[0], false);
    let k = j + 1;
    let trailingBlanks = 0;
    while (k < lines.length) {
      const line = lines[k];
      if (isBlank(line)) {
        // an empty item followed by blank line(s) is complete unless a
        // sibling list marker follows the blanks (cm-280 vs cm-315)
        if (itemLines.length === 1 && itemLines[0] === '') {
          let q = k;
          while (q < lines.length && isBlank(lines[q])) q++;
          const nm = q < lines.length ? matchListMarker(lines[q]) : null;
          if (!nm || nm.ordered !== ordered || nm.delim !== delim || nm.indent > 3) break;
        }
        itemLines.push('');
        trailingBlanks++;
        paraOpen = false;
        k++;
        continue;
      }
      const ind = indentOf(line);
      if (ind >= m.contentIndent) {
        // proper continuation: expand the leading whitespace first
        // (marked's `Z`), then slice off the item indent
        itemLines.push(expandLeadingWS(line).slice(m.contentIndent));
        trailingBlanks = 0;
        paraOpen = paraOpenAfterLine(itemLines[itemLines.length - 1], paraOpen);
        k++;
        continue;
      }
      const nm = matchListMarker(line);
      if (matchHR(line)) break;
      if (nm && nm.indent <= 3 && nm.ordered === ordered && nm.delim === delim) break;
      if (paraOpen && !isBlockStartForLazy(line)) {
        // lazy continuation: keep the line verbatim in the item text
        // (marked does not dedent it here); the re-lex of the item text
        // strips an indent of 4+ via the indented-code merge, and keeps
        // a smaller indent as paragraph text
        itemLines.push(line);
        trailingBlanks = 0;
        paraOpen = paraOpenAfterLine(line, paraOpen);
        k++;
        continue;
      }
      break;
    }
    if (trailingBlanks > 0) {
      itemLines.length -= trailingBlanks;
      // blank lines separate items (loose) only when another item follows;
      // otherwise leave them for the outer parser
      const nm2 = k < lines.length ? matchListMarker(lines[k]) : null;
      if (nm2 && nm2.indent <= 3 && nm2.ordered === ordered && nm2.delim === delim) {
        loose = true;
      } else {
        k -= trailingBlanks;
      }
    }
    // checkbox?
    let checkbox = null;
    if (itemLines.length > 0) {
      const c0 = itemLines[0];
      if (c0.startsWith('[ ]') && (c0.length === 3 || c0.charCodeAt(3) === 32 || c0.charCodeAt(3) === 9)) {
        checkbox = false;
        itemLines[0] = c0.slice(3);
      } else if ((c0.startsWith('[x]') || c0.startsWith('[X]')) && (c0.length === 3 || c0.charCodeAt(3) === 32 || c0.charCodeAt(3) === 9)) {
        checkbox = true;
        itemLines[0] = c0.slice(3);
      }
    }
    const sub = parseBlocks(itemLines, refs, st, { top: false, srcEndsWithNL: false });
    if (sub.loose) loose = true;
    items.push({ blocks: sub.blocks, checkbox });
    j = k;
    // the outer loop re-checks the sibling condition (indent <= 3);
    // a blank line between items is handled by the trailingBlanks logic
    if (j < lines.length) {
      const nm = matchListMarker(lines[j]);
      if (!nm || nm.ordered !== ordered || nm.delim !== delim || nm.indent > 3) break;
    }
  }
  return { node: { t: 'list', ordered, start, tight: !loose, items }, next: j };
}
// Main block parser. Returns {blocks, loose}.
function parseBlocks(lines, refs, st, opts) {
  const lazyFlags = opts && opts.lazyFlags ? opts.lazyFlags : null;
  const groupStartFlags = opts && opts.groupStartFlags ? opts.groupStartFlags : null;
  const top = !opts || opts.top !== false;
  const srcEndsWithNL = opts && opts.srcEndsWithNL !== false;
  const blocks = [];
  const n = lines.length;
  let i = 0;
  let para = null;
  let loose = false;
  let blankSeen = false;
  function addBlock(node) {
    if (blocks.length > 0 && blankSeen) loose = true;
    blocks.push(node);
    blankSeen = false;
  }
  function closePara() {
    if (!para) return;
    const node = finalizePara(para, refs);
    para = null;
    if (node) addBlock(node);
  }
  while (i < n) {
    const line = lines[i];
    const lazy = lazyFlags ? lazyFlags[i] : false;
    const groupStart = groupStartFlags ? groupStartFlags[i] : false;
    // A non-empty whitespace-only line that is the last line of a source
    // with no trailing newline is a paragraph continuation (marked's
    // paragraph regex matches it, since it is not followed by '\n').
    if (isBlank(line) && !lazy && para && i === n - 1 && !srcEndsWithNL && line.length > 0) {
      para.push(line);
      i++;
      continue;
    }
    if (isBlank(line) && !lazy) { closePara(); blankSeen = true; i++; continue; }
    if (para) {
      const delim = parseTableDelimiter(line);
      if (delim) {
        const headerCells = splitTableRow(para[para.length - 1]);
        if (headerCells.length === delim.count) {
          const headerLine = para.pop();
          let headNode = null;
          if (para.length > 0) {
            const h = finalizePara(para, refs);
            if (h) headNode = h;
          }
          para = null;
          const rows = [];
          let j = i + 1;
          while (j < n && !isTableRowEnd(lines[j])) {
            rows.push(splitTableRow(lines[j], delim.count));
            j++;
          }
          if (headNode) addBlock(headNode);
          addBlock({ t: 'table', align: delim.align, header: headerCells, rows });
          i = j;
          continue;
        }
      }
      if (!lazy) {
        const stx = isSetextLine(line);
        if (stx) {
          const rest = consumeRefDefs(para, refs);
          para = null;
          if (rest.length === 0) {
            // the paragraph was only link definitions: this line is not
            // a setext underline, re-process it as a new block
            continue;
          }
          let ht = rest.join('\n');
          let a2 = 0, b2 = ht.length;
          while (a2 < b2 && (ht.charCodeAt(a2) === 32 || ht.charCodeAt(a2) === 9)) a2++;
          while (b2 > a2 && (ht.charCodeAt(b2 - 1) === 32 || ht.charCodeAt(b2 - 1) === 9)) b2--;
          ht = ht.slice(a2, b2);
          if (ht.length > 0) addBlock({ t: 'heading', level: stx, text: ht });
          i++;
          continue;
        }
      }
      // In a list item (top false) the paragraph is really a one-line
      // text token, so ANY list marker ends it (marked re-lexes the next
      // line fresh); at the top level only a bullet or a '1.' list can
      // interrupt a paragraph.
      if (!lazy && (canInterrupt(line) || (!top && matchListMarker(line)))) { closePara(); continue; }
      // A lazy indented line that starts a new lexing group is lexed on
      // its own (it is an indented code block that merges into the
      // paragraph with its indent stripped); a lazy line continuing a
      // group keeps its leading spaces. The same merge applies when
      // re-lexing a list item's text (top false): an indented line is an
      // indented code block that merges into the paragraph text.
      if ((lazy && groupStart || !top) && indentOf(line) >= 4 && !isBlank(line)) para.push(stripUpTo(line, 4));
      else para.push(line);
      i++;
      continue;
    }
    if (isBlank(line)) { i++; continue; }
    const atx = matchATX(line);
    if (atx) { addBlock({ t: 'heading', level: atx.level, text: atx.content }); i++; continue; }
    const fence = matchFence(line);
    if (fence) {
      const f = parseFence(lines, i, fence);
      addBlock(f.node);
      i = f.next;
      continue;
    }
    const hb = matchHtmlBlock(line);
    if (hb) {
      const h = parseHtmlBlock(lines, i, hb);
      // The block's text is its lines joined with '\n', plus the newlines
      // that follow its last line (its own terminator plus any consecutive
      // blank lines after it); ge() then strips any run of trailing blank
      // lines, so a block ending at a blank line keeps no trailing '\n'
      // while one ending at a closing tag or at EOF keeps exactly one.
      // Types 1-5 end with (\n+|$) after the closing line, so only truly
      // EMPTY lines count; types 6-7 end at a blank line whose pattern
      // allows [ \t]*, so whitespace-only lines count too.
      let blankAfter = 0;
      let bk = h.next;
      if (hb.type <= 5) {
        while (bk < n && lines[bk].length === 0) { blankAfter++; bk++; }
      } else {
        while (bk < n && isBlank(lines[bk])) { blankAfter++; bk++; }
      }
      const terminated = h.next < n || srcEndsWithNL;
      const nlCount = terminated ? 1 + blankAfter : 0;
      h.node.text = geText(h.node.lines.join('\n') + '\n'.repeat(nlCount));
      addBlock(h.node);
      i = h.next;
      continue;
    }
    if (matchHR(line)) { addBlock({ t: 'hr' }); i++; continue; }
    const ind = indentOf(line);
    if (ind <= 3) {
      const rest = stripUpTo(line, ind);
      if (rest.charCodeAt(0) === 62) {
        const q = gatherBlockquote(lines, lazyFlags, i, refs, st);
        addBlock(q.node);
        i = q.next;
        continue;
      }
    }
    const lm = matchListMarker(line);
    if (lm) {
      const l = parseList(lines, i, refs, st);
      addBlock(l.node);
      i = l.next;
      continue;
    }
    if (ind >= 4) {
      const c = parseIndentedCode(lines, i);
      addBlock(c.node);
      i = c.next;
      continue;
    }
    if (blankSeen && blocks.length > 0) loose = true;
    para = [line];
    i++;
  }
  closePara();
  return { blocks, loose };
}

// ---------- rendering ----------
function renderBlocks(blocks, refs, st) {
  let out = '';
  for (const b of blocks) {
    if (b.t === 'para') {
      out += '<p>' + inlineToHtml(b.text, refs, st) + '</p>\n';
    } else if (b.t === 'heading') {
      out += '<h' + b.level + '>' + inlineToHtml(b.text, refs, st) + '</h' + b.level + '>\n';
    } else if (b.t === 'hr') {
      out += '<hr>\n';
    } else if (b.t === 'code') {
      const lang = b.lang ? ' class="language-' + escapeAttrEntity(b.lang) + '"' : '';
      // marked's code renderer strips one trailing newline then adds one,
      // so the content always ends with exactly one '\n' when non-empty
      const text = b.text.length > 0 ? b.text.replace(/\n$/, '') + '\n' : '';
      out += '<pre><code' + lang + '>' + escapeHtml(text) + '</code></pre>\n';
    } else if (b.t === 'html') {
      out += b.text;
    } else if (b.t === 'quote') {
      out += '<blockquote>\n' + renderBlocks(b.blocks, refs, st) + '</blockquote>\n';
    } else if (b.t === 'list') {
      const tag = b.ordered ? 'ol' : 'ul';
      const startAttr = b.ordered && b.start !== 1 ? ' start="' + b.start + '"' : '';
      out += '<' + tag + startAttr + '>\n';
      for (const item of b.items) {
        out += '<li>';
        const cb = item.checkbox === true ? '<input checked="" disabled="" type="checkbox">'
          : item.checkbox === false ? '<input disabled="" type="checkbox">' : '';
        if (item.blocks.length === 0) {
          out += cb;
        } else {
          // in a tight list every paragraph renders without <p> tags
          let first = true;
          for (const ib of item.blocks) {
            if (ib.t === 'para' && b.tight) {
              out += (first ? cb : '') + inlineToHtml(ib.text, refs, st);
            } else if (ib.t === 'para') {
              out += '<p>' + (first ? cb : '') + inlineToHtml(ib.text, refs, st) + '</p>\n';
            } else {
              out += (first ? cb : '') + renderBlocks([ib], refs, st);
            }
            first = false;
          }
        }
        out += '</li>\n';
      }
      out += '</' + tag + '>\n';
    } else if (b.t === 'table') {
      out += '<table>\n<thead>\n<tr>\n';
      for (let i = 0; i < b.header.length; i++) {
        const a = b.align[i] ? ' align="' + b.align[i] + '"' : '';
        out += '<th' + a + '>' + inlineToHtml(b.header[i], refs, st) + '</th>\n';
      }
      out += '</tr>\n</thead>\n';
      if (b.rows.length > 0) {
        out += '<tbody>';
        for (const row of b.rows) {
          out += '<tr>\n';
          for (let i = 0; i < row.length; i++) {
            const a = b.align[i] ? ' align="' + b.align[i] + '"' : '';
            out += '<td' + a + '>' + inlineToHtml(row[i], refs, st) + '</td>\n';
          }
          out += '</tr>\n';
        }
        out += '</tbody>';
      }
      out += '</table>\n';
    }
  }
  return out;
}

// Main entry point: render markdown to HTML, exactly like marked 18.1.3
// with default options.
export function parse(markdown) {
  const src = markdown.replace(/\r\n?/g, '\n');
  const refs = new Map();
  const st = makeInlineState();
  const lines = src.split('\n');
  // Tabs in leading whitespace are NOT expanded here: the structural
  // helpers (indentOf, stripUpTo, stripQuotePrefix, matchListMarker)
  // expand them at the point of use, and a tab inside indented-code
  // content must stay a literal tab (marked preserves it).
  const srcEndsWithNL = src.length === 0 || src.charCodeAt(src.length - 1) === 10;
  // Drop the phantom empty line that split() produces after a trailing
  // newline: it is not a real line, and blocks must not consume it.
  if (srcEndsWithNL && lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const { blocks } = parseBlocks(lines, refs, st, { top: true, srcEndsWithNL });
  return renderBlocks(blocks, refs, st);
}
