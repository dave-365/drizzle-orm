import { createClient } from '@libsql/client';
import { connectToLibSQL } from 'src/cli/connections';
import { expect, test } from 'vitest';

test('validate migrate function', async () => {
	const credentials = {
		url: ':memory:',
	};
	const { migrate, query } = await connectToLibSQL(credentials);

	await migrate({ migrationsFolder: 'tests/migrate/migrations' });

	const res = await query(`PRAGMA table_info("users");`);

	expect(res).toStrictEqual([{
		cid: 0,
		name: 'id',
		type: 'INTEGER',
		notnull: 0,
		dflt_value: null,
		pk: 0,
	}, {
		cid: 1,
		name: 'name',
		type: 'INTEGER',
		notnull: 1,
		dflt_value: null,
		pk: 0,
	}]);
});

test('validate partial migrate with to option', async () => {
	const credentials = {
		url: ':memory:',
	};
	const { migrate, query } = await connectToLibSQL(credentials);

	// Step 1: Migrate only up to 0000
	await migrate({
		migrationsFolder: 'tests/migrate/migrations',
		to: '0000_little_blizzard',
	});

	const resStep1 = await query(`PRAGMA table_info("users");`);
	expect(resStep1).toStrictEqual([{
		cid: 0,
		name: 'id',
		type: 'INTEGER',
		notnull: 1,
		dflt_value: null,
		pk: 1,
	}, {
		cid: 1,
		name: 'name',
		type: 'TEXT',
		notnull: 1,
		dflt_value: null,
		pk: 0,
	}]);

	// Step 2: Migrate up to 0001
	await migrate({
		migrationsFolder: 'tests/migrate/migrations',
		to: '0001_nebulous_storm',
	});

	const resStep2 = await query(`PRAGMA table_info("users");`);
	expect(resStep2).toStrictEqual([{
		cid: 0,
		name: 'id',
		type: 'INTEGER',
		notnull: 0,
		dflt_value: null,
		pk: 0,
	}, {
		cid: 1,
		name: 'name',
		type: 'INTEGER',
		notnull: 1,
		dflt_value: null,
		pk: 0,
	}]);

	// Step 3: Re-running with older target should be safe no-op
	await migrate({
		migrationsFolder: 'tests/migrate/migrations',
		to: '0000_little_blizzard',
	});

	const resStep3 = await query(`PRAGMA table_info("users");`);
	expect(resStep3.length).toBe(2);
});

// test('validate migrate function', async () => {
// 	const credentials = {
// 		url: '',
// 		authToken: '',
// 	};
// 	const { migrate, query } = await connectToLibSQL(credentials);

// 	await migrate({ migrationsFolder: 'tests/migrate/migrations' });

// 	const res = await query(`PRAGMA table_info("users");`);

// 	expect(res).toStrictEqual([{
// 		cid: 0,
// 		name: 'id',
// 		type: 'INTEGER',
// 		notnull: 0,
// 		dflt_value: null,
// 		pk: 0,
// 	}, {
// 		cid: 1,
// 		name: 'name',
// 		type: 'INTEGER',
// 		notnull: 1,
// 		dflt_value: null,
// 		pk: 0,
// 	}]);
// });
