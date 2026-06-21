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
const files = SEARCH_DIRS.flatMap((d) => walk(join(root, d)));
if (files.length === 0) {
  console.log(`${C.y}No lab files found under ${SEARCH_DIRS.join(', ')}.${C.x}`);
  process.exit(0);
}

let failed = 0;
for (const file of files.sort()) {
  const rel = file.slice(root.length + 1);
  const errors = [];
  const parseErrors = [];
  const spec = parseJsonc(readFileSync(file, 'utf-8'), parseErrors, { allowTrailingComma: true });
  if (parseErrors.length) {
    errors.push(`JSON parse: ${parseErrors.length} error(s) (first at offset ${parseErrors[0].offset})`);
  } else {
    if (!validateSchema(spec)) {
      for (const e of validateSchema.errors) errors.push(`schema ${e.instancePath || '/'} ${e.message}`);
    }
    errors.push(...staticGates(spec, file));
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
