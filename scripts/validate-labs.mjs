#!/usr/bin/env node
// Validate every community lab against lab.schema.json plus a set of semantic
// "static gates" the JSON Schema can't express (id↔filename, node↔edge refs,
// check↔node refs). Runs in GitHub Actions on every PR; also `npm test`.
//
// Block KINDS are NOT validated here — the registry is in the (private) engine
// repo, so a community lab's block kinds are only checked when labcheck runs it
// (private GitLab CI). This script catches everything structural up to that.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import Ajv from 'ajv';
import { parse as parseJsonc } from 'jsonc-parser';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SEARCH_DIRS = ['examples', 'submissions'];
const LAB_RE = /\.lab\.jsonc?$/;

// ── colors (cheap, TTY-or-CI aware) ─────────────────────────────────────────
const C = process.env.NO_COLOR ? { r: '', g: '', y: '', d: '', x: '' } :
  { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', x: '\x1b[0m' };
const ok = (s) => `${C.g}✓${C.x} ${s}`;
const bad = (s) => `${C.r}✗${C.x} ${s}`;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (LAB_RE.test(name)) out.push(p);
  }
  return out;
}

// ── load schema + compile ───────────────────────────────────────────────────
const schema = JSON.parse(readFileSync(join(root, 'lab.schema.json'), 'utf-8'));
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateSchema = ajv.compile(schema);

// ── slug uniqueness source = the live lab index (single source of truth) ─────
// No derived "reserved-slugs" file — we read potik's published index directly.
// POTIK_INDEX_URL is an http(s) URL (default) or a local path (tests). Fails
// open: if the index can't be read, the published-slug check is skipped (the
// bridge's canonical_slugs gate is the race-free backstop).
const INDEX_URL = process.env.POTIK_INDEX_URL ?? 'https://app.potik.org/labs/index.json';
async function fetchPublishedIds() {
  try {
    let text;
    if (/^https?:/.test(INDEX_URL)) {
      const res = await fetch(INDEX_URL, {
        headers: {
          'cache-control': 'no-cache',
          'accept': 'application/json',
          // A real UA gets past Cloudflare rules that 403 empty/undici user-agents.
          'user-agent': 'Mozilla/5.0 (compatible; potik-community-ci/1.0)',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } else {
      text = readFileSync(INDEX_URL, 'utf-8');
    }
    return { ids: new Set((JSON.parse(text).labs ?? []).map((l) => l.id)), ok: true };
  } catch (e) {
    return { ids: new Set(), ok: false, err: String(e?.message ?? e) };
  }
}

// ── semantic gates the schema can't express ─────────────────────────────────
function staticGates(spec, file) {
  const errs = [];
  const stem = basename(file).replace(LAB_RE, '');
  if (spec.id !== stem) errs.push(`id "${spec.id}" must match filename stem "${stem}"`);

  const nodeIds = new Set();
  for (const n of spec.graph?.nodes ?? []) {
    if (nodeIds.has(n.id)) errs.push(`duplicate node id "${n.id}"`);
    nodeIds.add(n.id);
  }
  for (const e of spec.graph?.edges ?? []) {
    if (e.source && !nodeIds.has(e.source)) errs.push(`edge ${e.id ?? ''} source "${e.source}" is not a node id`);
    if (e.target && !nodeIds.has(e.target)) errs.push(`edge ${e.id ?? ''} target "${e.target}" is not a node id`);
  }

  const checkIds = new Set();
  for (const c of spec.checks ?? []) {
    if (checkIds.has(c.id)) errs.push(`duplicate check id "${c.id}"`);
    checkIds.add(c.id);
    if (['block_present', 'block_absent', 'block_count'].includes(c.kind) && typeof c.blockKind !== 'string') {
      errs.push(`check "${c.id}" (${c.kind}) needs a string "blockKind"`);
    }
    // Live checks that point at a sink node by id.
    if (typeof c.block === 'string' && !nodeIds.has(c.block)) {
      errs.push(`check "${c.id}" references block "${c.block}" which is not a node id`);
    }
  }
  return errs;
}

// ── run ──────────────────────────────────────────────────────────────────────
const files = SEARCH_DIRS.flatMap((d) => walk(join(root, d))).sort();
if (files.length === 0) {
  console.log(`${C.y}No lab files found under ${SEARCH_DIRS.join(', ')}.${C.x}`);
  process.exit(0);
}

// Parse everything once, then derive cross-file facts (intra-repo id dups +
// published-slug collisions) before reporting per file.
const loaded = files.map((file) => {
  const parseErrors = [];
  const spec = parseJsonc(readFileSync(file, 'utf-8'), parseErrors, { allowTrailingComma: true });
  return { file, rel: file.slice(root.length + 1), spec, parseErrors };
});

const idToFiles = new Map();
for (const { rel, spec, parseErrors } of loaded) {
  if (parseErrors.length || typeof spec?.id !== 'string') continue;
  if (!idToFiles.has(spec.id)) idToFiles.set(spec.id, []);
  idToFiles.get(spec.id).push(rel);
}

const published = await fetchPublishedIds();
console.log(published.ok
  ? `${C.d}slug source: ${INDEX_URL} — ${published.ids.size} published ids${C.x}`
  : `${C.y}⚠ could not read the lab index (${INDEX_URL}): ${published.err} — skipping published-slug uniqueness (the bridge's canonical_slugs gate still applies)${C.x}`);

let failed = 0;
for (const { file, rel, spec, parseErrors } of loaded) {
  const errors = [];
  if (parseErrors.length) {
    errors.push(`JSON parse: ${parseErrors.length} error(s) (first at offset ${parseErrors[0].offset})`);
  } else {
    if (!validateSchema(spec)) {
      for (const e of validateSchema.errors) errors.push(`schema ${e.instancePath || '/'} ${e.message}`);
    }
    errors.push(...staticGates(spec, file));
    if (typeof spec.id === 'string') {
      const dupes = (idToFiles.get(spec.id) ?? []).filter((f) => f !== rel);
      if (dupes.length) errors.push(`id "${spec.id}" is not unique — also defined in ${dupes.join(', ')}`);
      // Published-slug collision applies to submissions only — examples may
      // intentionally mirror a published lab (they're copy-me references).
      if (rel.startsWith('submissions/') && published.ok && published.ids.has(spec.id)) {
        errors.push(`id "${spec.id}" is already published — pick a unique slug (potik.org/labs/${spec.id} exists)`);
      }
    }
  }

  if (errors.length) {
    failed++;
    console.log(bad(rel));
    for (const e of errors) console.log(`    ${C.d}→${C.x} ${e}`);
  } else {
    console.log(ok(rel));
  }
}

console.log('');
if (failed) {
  console.log(bad(`${failed}/${files.length} lab(s) failed validation`));
  process.exit(1);
}
console.log(ok(`${files.length} lab(s) valid`));
