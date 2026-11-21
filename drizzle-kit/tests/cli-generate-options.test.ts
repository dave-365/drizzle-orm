import { test as brotest } from '@drizzle-team/brocli';
import { assert, expect, test } from 'vitest';
import { generate } from '../src/cli/schema';
import { filterPgEntitiesByOnly, preserveMissingPgEntities } from '../src/cli/commands/migrate';
import { fromJson } from '../src/sqlgenerator';
import type { PgSchema } from '../src/serializer/pgSchema';

const createPgTable = (
	name: string,
	schema = 'public',
	overrides: Partial<PgSchema['tables'][string]> = {},
): PgSchema['tables'][string] => ({
	name,
	schema,
	columns: {},
	indexes: {},
	foreignKeys: {},
	compositePrimaryKeys: {},
	uniqueConstraints: {},
	policies: {},
	checkConstraints: {},
	isRLSEnabled: false,
	...overrides,
});

const createPgSchema = (overrides: Partial<PgSchema> = {}): PgSchema => ({
	version: '7',
	dialect: 'postgresql',
	id: 'test-id',
	prevId: '0000',
	schemas: { public: 'public' },
	enums: {},
	tables: {},
	sequences: {},
	roles: {},
	policies: {},
	views: {},
	_meta: {
		columns: {},
		tables: {},
		schemas: {},
	},
	...overrides,
});

test('generate command accepts --only and --no-drop flags', async () => {
	const res = await brotest(generate, '--only=enums --no-drop --name=add_surprise');
	if (res.type !== 'handler') {
		console.log('brotest result:', res);
		assert.fail(res.type, 'handler');
	}
	expect(res.options.only).toBe('enums');
	expect(res.options.noDrop).toBe(true);
	expect(res.options.name).toBe('add_surprise');
});

test('preserveMissingPgEntities retains commented-out / missing tables and enums when noDrop is active', () => {
	const prev: PgSchema = createPgSchema({
		enums: {
			'hostel.inspection_type': {
				name: 'inspection_type',
				schema: 'hostel',
				values: ['routine', 'vacate'],
			},
			'hostel.status': {
				name: 'status',
				schema: 'hostel',
				values: ['active', 'inactive'],
			},
		},
		tables: {
			'public.users': createPgTable('users', 'public', {
				columns: {
					id: { name: 'id', type: 'serial', primaryKey: true, notNull: true },
					email: { name: 'email', type: 'text', primaryKey: false, notNull: true },
				},
			}),
		},
	});

	// Suppose in the current file, users table and status enum were commented out,
	// and only inspection_type had 'surprise' added!
	const cur: PgSchema = createPgSchema({
		enums: {
			'hostel.inspection_type': {
				name: 'inspection_type',
				schema: 'hostel',
				values: ['routine', 'vacate', 'surprise'],
			},
		},
		tables: {},
	});

	const preserved = preserveMissingPgEntities(prev, cur);

	// The missing 'users' table and missing 'status' enum are preserved!
	expect(preserved.tables['public.users']).toBeDefined();
	expect(preserved.enums['hostel.status']).toBeDefined();
	// The new 'surprise' value is present in the updated enum
	expect(preserved.enums['hostel.inspection_type']?.values).toContain('surprise');
});

test('filterPgEntitiesByOnly isolates specific entity type', () => {
	const prev: PgSchema = createPgSchema({
		enums: {
			'hostel.inspection_type': {
				name: 'inspection_type',
				schema: 'hostel',
				values: ['routine'],
			},
		},
		tables: {
			'public.users': createPgTable('users', 'public'),
		},
	});

	const cur: PgSchema = createPgSchema({
		enums: {
			'hostel.inspection_type': {
				name: 'inspection_type',
				schema: 'hostel',
				values: ['routine', 'surprise'],
			},
		},
		tables: {
			'public.new_table': createPgTable('new_table', 'public'),
		},
	});

	const onlyEnums = filterPgEntitiesByOnly(prev, cur, 'enums');
	// Only enums are taken from cur; new_table is not included
	expect(onlyEnums.enums['hostel.inspection_type']?.values).toContain('surprise');
	expect(onlyEnums.tables['public.new_table']).toBeUndefined();
	expect(onlyEnums.tables['public.users']).toBeDefined();
});

test('alter_type_add_value generates IF NOT EXISTS statement', () => {
	const sql = fromJson(
		[
			{
				type: 'alter_type_add_value',
				name: 'inspection_type_enum',
				schema: 'hostel',
				value: 'surprise',
				before: '',
			},
		],
		'postgresql',
	);

	expect(sql).toStrictEqual([
		`ALTER TYPE "hostel"."inspection_type_enum" ADD VALUE IF NOT EXISTS 'surprise';`,
	]);
});
