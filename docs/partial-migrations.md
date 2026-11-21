# Partial Migrations & Granular Generation in Drizzle

This document details the partial migration execution capabilities and granular generation options in `drizzle-orm` and `drizzle-kit`.

---

## Table of Contents
1. [Overview](#overview)
2. [Runtime Partial Migrations (`drizzle-orm`)](#runtime-partial-migrations-drizzle-orm)
   - [API Reference](#api-reference)
   - [Code Examples](#code-examples)
   - [Behavior & Edge Cases](#behavior--edge-cases)
3. [CLI Partial Migrations (`drizzle-kit migrate --to`)](#cli-partial-migrations-drizzle-kit-migrate---to)
   - [Usage](#usage)
   - [Tag Resolution](#tag-resolution)
4. [Non-Destructive Generation (`drizzle-kit generate --no-drop`)](#non-destructive-generation-drizzle-kit-generate---no-drop)
   - [Problem Statement](#problem-statement)
   - [Usage](#usage-1)
   - [Commented-Out Schema Workflow](#commented-out-schema-workflow)
5. [Targeted Entity Generation (`drizzle-kit generate --only`)](#targeted-entity-generation-drizzle-kit-generate---only)
   - [Usage](#usage-2)
   - [Targeting Enums & Tables](#targeting-enums--tables)
6. [PostgreSQL Enum Idempotency (`IF NOT EXISTS`)](#postgresql-enum-idempotency-if-not-exists)
7. [Testing & Verification](#testing--verification)

---

## Overview

In modern application development and CI/CD pipelines, executing every migration all at once is not always desirable. Staged deployments, canary releases, and debugging require applying migrations up to a specific version.

Similarly, during active development or when working with large modular schemas, generating migration SQL for only specific newly added entities—without dropping unreferenced or temporarily commented-out schema models—is essential for safe and predictable migrations.

---

## Runtime Partial Migrations (`drizzle-orm`)

### API Reference

All `drizzle-orm` dialect migrators (`node-postgres`, `postgres-js`, `better-sqlite3`, `libsql`, `d1`, `durable-sqlite`, `expo-sqlite`, `op-sqlite`, `mysql2`, etc.) support the `to` parameter in `MigrationConfig`:

```typescript
export interface MigrationConfig {
  migrationsFolder: string;
  migrationsTable?: string;
  migrationsSchema?: string;
  /**
   * Stop applying migrations inclusively at the specified migration tag or prefix.
   * e.g. "0001", "0001_initial_schema", or "0001_initial_schema.sql"
   */
  to?: string;
}
```

### Code Examples

#### PostgreSQL (`node-postgres`)
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Apply migrations up to migration 0002 inclusively
await migrate(db, {
  migrationsFolder: './drizzle',
  to: '0002_add_user_roles',
});
```

#### SQLite / LibSQL
```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';

const client = createClient({ url: 'file:local.db' });
const db = drizzle(client);

// Migrate up to 0000 prefix
await migrate(db, {
  migrationsFolder: './drizzle',
  to: '0000',
});
```

### Behavior & Edge Cases

1. **Inclusive Application**: Migrations are applied in sequential order from unapplied migrations up to and including the target specified by `to`.
2. **Tag Matching Flexibility**:
   - Exact tag name: `0001_little_blizzard`
   - Prefix match: `0001`
   - SQL filename: `0001_little_blizzard.sql`
3. **Missing Target Error**: If the specified target migration does not exist in `_journal.json`, an error is thrown immediately before any SQL executes:
   ```
   Error: Target migration "0099_unknown" not found in journal.
   ```
4. **Already Applied Migrations**: If the database is already migrated past the target, `migrate()` verifies the hash integrity of existing records in `__drizzle_migrations` and exits safely as a no-op without re-applying or altering `created_at` ordering.

---

## CLI Partial Migrations (`drizzle-kit migrate --to`)

### Usage

The `drizzle-kit migrate` command supports the `--to` flag:

```bash
# Migrate up to tag 0002
drizzle-kit migrate --to 0002

# Or specify full migration name
drizzle-kit migrate --to 0002_add_hostel_enums
```

### Tag Resolution
The CLI forwards `--to` to the respective database migrator. It supports all database dialects configured in your `drizzle.config.ts`.

---

## Non-Destructive Generation (`drizzle-kit generate --no-drop`)

### Problem Statement
By default, Drizzle Kit compares your TypeScript schema against the previous snapshot. If an entity (such as a table, enum, or column) is missing from the TypeScript schema (e.g., if you temporarily commented it out or imported a subset of models), Drizzle Kit produces destructive `DROP TABLE`, `DROP TYPE`, or `DROP COLUMN` SQL statements.

### Usage
Run `generate` with the `--no-drop` flag:

```bash
drizzle-kit generate --no-drop --name add_new_features
```

### Commented-Out Schema Workflow
When you comment out parts of your schema file to isolate a single change:
1. Edit only the target enum or table in your schema file.
2. Run `drizzle-kit generate --no-drop --name my_change`.
3. Drizzle Kit preserves all missing database entities in the snapshot and omits all `DROP` statements from the generated `.sql` file.
4. Uncomment your code and resume development safely.

---

## Targeted Entity Generation (`drizzle-kit generate --only`)

### Usage
Generate migration statements affecting only a specific table or enum name:

```bash
# Generate changes for only the inspection_type_enum
drizzle-kit generate --only inspection_type_enum --name add_surprise_inspection

# Schema-qualified entity names are also supported
drizzle-kit generate --only hostel.inspection_type_enum --name add_surprise_inspection
```

When combined with `--no-drop`, this gives complete control over surgical schema changes:

```bash
drizzle-kit generate --only inspection_type_enum --no-drop --name add_surprise_inspection
```

---

## PostgreSQL Enum Idempotency (`IF NOT EXISTS`)

When new values are added to PostgreSQL enums, Drizzle Kit now generates `IF NOT EXISTS` syntax:

```sql
ALTER TYPE "hostel"."inspection_type_enum" ADD VALUE IF NOT EXISTS 'surprise';
```

This prevents runtime database errors if the value was already provisioned or during re-runs of migration scripts.

---

## Testing & Verification

### Running the Test Suites

#### `drizzle-orm` Unit Tests
```bash
pnpm --filter drizzle-orm test tests/migrator.test.ts
```
Verifies:
- Full migration when `to` is omitted.
- Exact tag matching (`0001_little_blizzard`).
- Prefix tag matching (`0001`).
- Tag with `.sql` extension (`0001_little_blizzard.sql`).
- Error thrown when target tag is not found in the journal.

#### `drizzle-kit` Unit & Integration Tests
```bash
cd drizzle-kit
pnpm test
```
Or run the specific suites:
```bash
cd drizzle-kit
TEST_CONFIG_PATH_PREFIX=./tests/cli/ pnpm exec vitest run tests/cli-migrate.test.ts tests/migrate/libsql-migrate.test.ts tests/cli-generate-options.test.ts
```
Verifies:
- BroCLI command schema parsing for `--to`, `--only`, and `--no-drop`.
- Config fallback when passing CLI options (`prepareGenerateConfig`).
- End-to-end database migrations against real LibSQL databases using `--to`.
- Snapshot entity preservation and `DROP` suppression with `--no-drop`.
- Selective entity statement filtering with `--only`.
- Safe `ALTER TYPE ... ADD VALUE IF NOT EXISTS` generation.

