import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { readMigrationFiles } from '~/migrator.ts';

describe('readMigrationFiles partial migration (to)', () => {
	let tempDir: string;

	beforeAll(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drizzle-test-migrations-'));
		const metaDir = path.join(tempDir, 'meta');
		fs.mkdirSync(metaDir, { recursive: true });

		const journal = {
			version: '7',
			dialect: 'postgresql',
			entries: [
				{
					idx: 0,
					version: '7',
					when: 1700000000000,
					tag: '0000_early_worm',
					breakpoints: true,
				},
				{
					idx: 1,
					version: '7',
					when: 1700001000000,
					tag: '0001_late_bird',
					breakpoints: true,
				},
				{
					idx: 2,
					version: '7',
					when: 1700002000000,
					tag: '0002_quiet_thunderbolt',
					breakpoints: true,
				},
			],
		};

		fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journal, null, 2));
		fs.writeFileSync(path.join(tempDir, '0000_early_worm.sql'), 'CREATE TABLE "t0" (id serial);');
		fs.writeFileSync(path.join(tempDir, '0001_late_bird.sql'), 'CREATE TABLE "t1" (id serial);');
		fs.writeFileSync(path.join(tempDir, '0002_quiet_thunderbolt.sql'), 'CREATE TABLE "t2" (id serial);');
	});

	afterAll(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('should read all migrations when "to" is not specified', () => {
		const migrations = readMigrationFiles({ migrationsFolder: tempDir });
		expect(migrations.length).toBe(3);
		expect(migrations[0]!.folderMillis).toBe(1700000000000);
		expect(migrations[1]!.folderMillis).toBe(1700001000000);
		expect(migrations[2]!.folderMillis).toBe(1700002000000);
	});

	test('should read up to target migration by exact tag', () => {
		const migrations = readMigrationFiles({
			migrationsFolder: tempDir,
			to: '0000_early_worm',
		});
		expect(migrations.length).toBe(1);
		expect(migrations[0]!.folderMillis).toBe(1700000000000);
	});

	test('should read up to target migration by prefix', () => {
		const migrations = readMigrationFiles({
			migrationsFolder: tempDir,
			to: '0001',
		});
		expect(migrations.length).toBe(2);
		expect(migrations[0]!.folderMillis).toBe(1700000000000);
		expect(migrations[1]!.folderMillis).toBe(1700001000000);
	});

	test('should support tag with .sql extension', () => {
		const migrations = readMigrationFiles({
			migrationsFolder: tempDir,
			to: '0001_late_bird.sql',
		});
		expect(migrations.length).toBe(2);
		expect(migrations[1]!.folderMillis).toBe(1700001000000);
	});

	test('should throw clear error when target migration tag does not exist', () => {
		expect(() =>
			readMigrationFiles({
				migrationsFolder: tempDir,
				to: '0099_does_not_exist',
			})
		).toThrowError('Target migration "0099_does_not_exist" not found in journal');
	});
});

