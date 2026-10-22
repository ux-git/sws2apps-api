import { getStorage } from 'firebase-admin/storage';

import type { StorageBackend } from '#platform/storage/storage-backend.types.js';

export const firebaseStorage: StorageBackend = {
	save: async (path, data) => {
		await getStorage().bucket().file(path).save(data, {
			metadata: { contentType: 'text/plain' },
		});
	},

	read: async (path) => {
		const file = getStorage().bucket().file(path);
		const [fileExists] = await file.exists();

		if (!fileExists) return undefined;

		const [contents] = await file.download();
		return contents.toString();
	},

	metadata: async (path) => {
		const file = getStorage().bucket().file(path);
		const [fileExists] = await file.exists();

		if (!fileExists) return undefined;

		return {
			updated: file.metadata.updated || '',
			timeCreated: file.metadata.timeCreated || '',
			contentType: file.metadata.contentType,
		};
	},

	list: async (prefix) => {
		const [files] = await getStorage().bucket().getFiles({ prefix });

		return files.map((file) => ({ name: file.name, updated: file.metadata.updated || '' }));
	},

	deletePrefix: async (prefix) => {
		await getStorage().bucket().deleteFiles({ prefix, force: true });
	},
};
