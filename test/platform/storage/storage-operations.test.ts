import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
	deleteFileFromStorage,
	getFileFromStorage,
	getFileMetadata,
	listFilesFromStorage,
	readModifyWriteFile,
	setStorageBackend,
	uploadFileToStorage,
} from '#platform/firebase/storage.js';
import { createFilesystemStorage } from '#platform/storage/filesystem-storage.js';

describe('storage operations on the filesystem backend', () => {
	let directory: string;

	before(async () => {
		directory = await mkdtemp(join(tmpdir(), 'organized-storage-ops-'));
		setStorageBackend(createFilesystemStorage(directory));
	});

	after(async () => {
		setStorageBackend(undefined);
		await rm(directory, { recursive: true, force: true });
	});

	it('keeps objects encrypted at rest and decrypts them on read', async () => {
		await uploadFileToStorage('{"cong_name":"Central"}', { type: 'congregation', path: 'c1/settings/main.txt' });

		const raw = await readFile(join(directory, 'v3/congregations/c1/settings/main.txt'), 'utf8');

		assert.ok(!raw.includes('Central'));
		assert.equal(
			await getFileFromStorage({ type: 'congregation', path: 'c1/settings/main.txt' }),
			'{"cong_name":"Central"}',
		);
		assert.ok((await getFileMetadata({ type: 'congregation', path: 'c1/settings/main.txt' }))?.updated);
	});

	it('lists with contents and deletes a whole record folder', async () => {
		await uploadFileToStorage('one', { type: 'user', path: 'u1/settings.txt' });
		await uploadFileToStorage('two', { type: 'user', path: 'u1/sessions.txt' });

		const files = await listFilesFromStorage({ type: 'user', path: 'u1/', includeContents: true });

		assert.deepEqual(files.map((file) => file.contents).sort(), ['one', 'two']);

		await deleteFileFromStorage({ type: 'user', path: 'u1/' });

		assert.deepEqual(await listFilesFromStorage({ type: 'user', path: 'u1/' }), []);
	});

	it('orders concurrent plain writes and read-modify-writes to the same file', async () => {
		const options = { type: 'api' as const, path: 'counter.txt' };
		await uploadFileToStorage('0', options);

		await Promise.all([
			...Array.from({ length: 5 }, () =>
				readModifyWriteFile(options, async (current) => ({
					data: String(Number(current) + 1),
					result: undefined,
				})),
			),
			uploadFileToStorage('100', options),
		]);

		const value = Number(await getFileFromStorage(options));

		assert.ok(value >= 5, `expected every increment to apply, got ${value}`);
	});
});
