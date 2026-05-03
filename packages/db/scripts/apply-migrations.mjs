#!/usr/bin/env node
//
// Canonical migration runner for this repo.
//
// Why not `drizzle-kit migrate`? Because hand-rolled SQL files (anything past
// 0002) aren't recorded in drizzle's meta journal — drizzle-kit then silently
// skips them on later runs. This runner sidesteps that by tracking applied
// migrations in a simple `aani_migrations(name, applied_at)` table.
//
// Usage:
//   node packages/db/scripts/apply-migrations.mjs                # apply pending
//   node packages/db/scripts/apply-migrations.mjs --dry-run      # preview only
//   node packages/db/scripts/apply-migrations.mjs --bootstrap    # mark all
//                                                                # current files
//                                                                # as applied
//                                                                # WITHOUT
//                                                                # running them
//                                                                # (use on
//                                                                # existing DBs)
//
// Reads EXPO_PUBLIC_DATABASE_URL from .env at the repo root.
// Run via npm: `npm run db:apply` or `npm run db:bootstrap`.

import { Pool } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "drizzle");

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dry-run");
const bootstrap = argv.has("--bootstrap");

const url = process.env.EXPO_PUBLIC_DATABASE_URL;
if (!url) {
  console.error("EXPO_PUBLIC_DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aani_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function listAppliedNames() {
  const res = await pool.query(`SELECT name FROM aani_migrations ORDER BY name`);
  return new Set(res.rows.map((r) => r.name));
}

function listMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort();
}

function splitStatements(sql) {
  const stripped = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return stripped
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;$/, ""))
    .filter((s) => s.length > 0);
}

async function applyOne(name) {
  const path = join(migrationsDir, name);
  const sql = readFileSync(path, "utf8");
  const stmts = splitStatements(sql);
  console.log(`  ${name}  (${stmts.length} statement${stmts.length === 1 ? "" : "s"})`);
  for (const [i, stmt] of stmts.entries()) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 110);
    console.log(`    [${i + 1}/${stmts.length}] ${preview}${stmt.length > 110 ? "..." : ""}`);
    if (dryRun) continue;
    try {
      await pool.query(stmt);
    } catch (e) {
      console.error(`    ERROR in ${name} statement ${i + 1}: ${e.message}`);
      throw e;
    }
  }
  if (!dryRun) {
    await pool.query(`INSERT INTO aani_migrations (name) VALUES ($1)`, [name]);
  }
}

async function main() {
  await ensureMigrationsTable();
  const applied = await listAppliedNames();
  const files = listMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (bootstrap) {
    if (applied.size > 0) {
      console.log(
        `aani_migrations already has ${applied.size} entries. Bootstrap aborted ` +
          `(this command is a one-time use on a fresh tracking table).`,
      );
      process.exit(1);
    }
    console.log(
      `Bootstrapping aani_migrations with ${files.length} existing files (NOT executing them):`,
    );
    for (const name of files) {
      console.log(`  ${name}`);
      if (!dryRun) {
        await pool.query(`INSERT INTO aani_migrations (name) VALUES ($1)`, [name]);
      }
    }
    console.log(dryRun ? "Done (dry-run)." : "Done.");
    return;
  }

  if (pending.length === 0) {
    console.log(
      `All ${files.length} migration file(s) are already applied. Nothing to do.`,
    );
    return;
  }

  console.log(
    `${pending.length} pending migration${pending.length === 1 ? "" : "s"}:`,
  );
  for (const name of pending) await applyOne(name);
  console.log(dryRun ? "\nDone (dry-run, no writes)." : "\nDone.");
}

try {
  await main();
} finally {
  await pool.end();
}
