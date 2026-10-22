import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

describe('document store on the filesystem backend', () => {
	let directory: string;
	let documentStore: typeof import('#platform/firebase/document-store.js');

	before(async () => {
		directory = await mkdtemp(join(tmpdir(), 'organized-documents-'));

		// each test file runs in its own process, so this only configures this file
		process.env.STORAGE_BACKEND = 'filesystem';
		process.env.STORAGE_DIRECTORY = directory;

		documentStore = await import('#platform/firebase/document-store.js');
	});

	after(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	it('adds, reads and updates records without Firestore', async () => {
		const collection = 'api_settings_v3';

		assert.deepEqual(await documentStore.getCollectionRecords(collection), []);
		assert.equal(await documentStore.getFirstCollectionRecord(collection), undefined);

		await documentStore.addCollectionRecord(collection, { minimum_version: '1.0.0' });

		const record = await documentStore.getFirstCollectionRecord(collection);
		assert.deepEqual(record?.data, { minimum_version: '1.0.0' });

		await documentStore.updateCollectionRecord(collection, record!.id, { minimum_version: '2.0.0' });

		assert.deepEqual(await documentStore.getCollectionRecords(collection), [
			{ id: record!.id, data: { minimum_version: '2.0.0' } },
		]);
		await assert.rejects(
			documentStore.updateCollectionRecord(collection, 'missing', {}),
			/not found/,
		);
	});
});
