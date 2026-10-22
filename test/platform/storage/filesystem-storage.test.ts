import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createFilesystemStorage } from '#platform/storage/filesystem-storage.js';

describe('filesystem storage backend', () => {
	let directory: string;

	before(async () => {
		directory = await mkdtemp(join(tmpdir(), 'organized-storage-'));
	});

	after(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	it('stores, reads and describes an object without leaving temporary files', async () => {
		const storage = createFilesystemStorage(directory);

		await storage.save('v3/congregations/c1/settings/main.txt', 'first');
		await storage.save('v3/congregations/c1/settings/main.txt', 'second');

		assert.equal(await storage.read('v3/congregations/c1/settings/main.txt'), 'second');

		const metadata = await storage.metadata('v3/congregations/c1/settings/main.txt');
		assert.ok(metadata && !Number.isNaN(Date.parse(metadata.updated)));
		assert.ok(!Number.isNaN(Date.parse(metadata.timeCreated)));

		const files = await readdir(join(directory, 'v3/congregations/c1/settings'));
		assert.deepEqual(files, ['main.txt']);
	});

	it('treats missing objects and directories as absent', async () => {
		const storage = createFilesystemStorage(directory);

		await storage.save('v3/users/u1/settings.txt', 'data');

		assert.equal(await storage.read('v3/users/u2/settings.txt'), undefined);
		assert.equal(await storage.metadata('v3/users/u2/settings.txt'), undefined);
		assert.equal(await storage.read('v3/users/u1'), undefined);
		assert.equal(await storage.metadata('v3/'), undefined);
	});

	it('lists and deletes by plain string prefix, like an object store', async () => {
		const storage = createFilesystemStorage(directory);

		await storage.save('v3/congregations/c2/reports/main.txt', 'a');
		await storage.save('v3/congregations/c2/reports/incoming.txt', 'b');
		await storage.save('v3/congregations/c20/reports/main.txt', 'c');

		const listed = await storage.list('v3/congregations/c2/');
		assert.deepEqual(listed.map((object) => object.name).sort(), [
			'v3/congregations/c2/reports/incoming.txt',
			'v3/congregations/c2/reports/main.txt',
		]);

		const byNamePrefix = await storage.list('v3/congregations/c2');
		assert.equal(byNamePrefix.length, 3);

		await storage.deletePrefix('v3/congregations/c2/');

		assert.equal(await storage.read('v3/congregations/c2/reports/main.txt'), undefined);
		assert.equal(await storage.read('v3/congregations/c20/reports/main.txt'), 'c');
		assert.deepEqual(await storage.list('v3/missing/'), []);
	});

	it('refuses paths that escape the storage directory', async () => {
		const storage = createFilesystemStorage(directory);

		await assert.rejects(storage.save('../outside.txt', 'x'), /escapes the storage directory/);
		await assert.rejects(storage.read('v3/../../outside.txt'), /escapes the storage directory/);
	});
});
