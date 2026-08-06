#!/usr/bin/env node
/*
 * Fails if, after applying every migration in order, a function in `public`
 * would still be left with the EXECUTE grant it is born with.
 *
 * Why this exists: PostgreSQL grants EXECUTE to PUBLIC on every new function,
 * and `anon` is a member of PUBLIC — so a new function is anon-callable the
 * moment it is created. Default privileges cannot suppress that (see README).
 * The event trigger added in 20260806140000 does it automatically, but
 * creating an event trigger needs superuser and may be refused on a hosted
 * project, so this is the backstop that always works.
 *
 * It judges the end state, not each file: a function created in an early
 * migration and locked down in a later one is fine. Trigger and event-trigger
 * bodies are skipped — they take no role grants.
 *
 *   node scripts/check_function_grants.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../supabase/migrations/', import.meta.url).pathname;

const CREATE_FN =
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]{0,400}?)\)\s*RETURNS\s+"?([a-z_]+)"?/gi;

// A REVOKE naming the function directly...
const REVOKE_FN = /REVOKE\s+[\s\S]{0,80}?ON\s+FUNCTION\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi;
// ...or the function appearing in a migration's explicit grant allowlist,
// which is how the sweep migrations handle them.
const ALLOWLISTED = /'public\.([a-z0-9_]+)\([^)]*\)'/gi;

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

/** fn -> { createdAt: file, handledAt: file|null, returns: string } */
const state = new Map();

for (const file of files) {
  const sql = readFileSync(join(DIR, file), 'utf8');
  const code = sql.replace(/\/\*[\s\S]*?\*\//g, ''); // drop doc comments

  for (const m of code.matchAll(CREATE_FN)) {
    const fn = m[1].toLowerCase();
    const returns = m[3].replace(/"/g, '').trim().toLowerCase();
    const prev = state.get(fn);
    state.set(fn, { createdAt: file, handledAt: prev?.handledAt ?? null, returns });
  }

  for (const re of [REVOKE_FN, ALLOWLISTED]) {
    for (const m of code.matchAll(re)) {
      const fn = m[1].toLowerCase();
      if (state.has(fn)) state.get(fn).handledAt = file;
    }
  }
}

const problems = [];
for (const [fn, { createdAt, handledAt, returns }] of state) {
  if (returns === 'trigger' || returns === 'event_trigger') continue;
  // Handled only counts if it happened in the same migration or a later one.
  if (handledAt && handledAt >= createdAt) continue;
  problems.push({ fn, createdAt, handledAt });
}

if (problems.length === 0) {
  console.log(`OK: ${state.size} function(s) checked, all have an explicit REVOKE.`);
  process.exit(0);
}

console.error('Functions left with their default PUBLIC/anon EXECUTE grant:\n');
for (const { fn, createdAt, handledAt } of problems) {
  console.error(`  ${fn}()`);
  console.error(`    created/replaced in : ${createdAt}`);
  console.error(`    last locked down in : ${handledAt ?? '(never)'}`);
}
console.error(`
Every new function is born with EXECUTE granted to PUBLIC, which includes anon.
Add to the migration that creates it:

  REVOKE ALL ON FUNCTION public.<name>(<args>) FROM public, anon;
  GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO authenticated;  -- or anon / service_role

See README, "Database functions: two rules, both mandatory".`);
process.exit(1);
