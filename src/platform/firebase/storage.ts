import { env } from '#config/env.js';
import { decryptData, encryptData } from '#platform/encryption/encryption.js';
import { createFilesystemStorage } from '#platform/storage/filesystem-storage.js';
import type { StorageBackend } from '#platform/storage/storage-backend.types.js';
import { firebaseStorage } from './firebase-storage.js';
import type {
	StorageBaseType,
	StorageFileEntry,
	StorageFileListOptions,
} from './storage.types.js';

let storageBackend: StorageBackend | undefined;

const getStorageBackend = () => {
	storageBackend ??=
		env.storageBackend === 'filesystem'
			? createFilesystemStorage(env.storageDirectory!)
			: firebaseStorage;

	return storageBackend;
};

/**
 * Replaces the configured backend; meant for tests that exercise the storage
 * operations against a temporary directory.
 */
export const setStorageBackend = (backend: StorageBackend | undefined) => {
	storageBackend = backend;
};

export const buildStoragePath = (
	{ path, type }: StorageBaseType,
	includeApiStorage = true,
): string => {
	let destinationPath = 'v3/';

	if (type === 'congregation') {
		destinationPath += `congregations/${path}`;
	}

	if (type === 'user') {
		destinationPath += `users/${path}`;
	}

	if (type === 'api' && includeApiStorage) {
		destinationPath += `api/${path}`;
	}

	return destinationPath;
};

const writeFileToStorage = async (data: string, options: StorageBaseType) => {
	const encryptedData = encryptData(data);

	await getStorageBackend().save(buildStoragePath(options), encryptedData);

	return encryptedData;
};

// writes to one file never interleave, whichever backend stores it
export const uploadFileToStorage = (data: string, options: StorageBaseType) => {
	return runWithinFileWriteQueue(buildStoragePath(options), () => writeFileToStorage(data, options));
};

export const getFileMetadata = async (options: StorageBaseType) => {
	return getStorageBackend().metadata(buildStoragePath(options, false));
};

export const getFileFromStorage = async (options: StorageBaseType) => {
	const encryptedData = await getStorageBackend().read(buildStoragePath(options));

	if (encryptedData !== undefined) {
		return decryptData(encryptedData);
	}
};

const fileWriteQueues = new Map<string, Promise<unknown>>();
const fileWriteQueueCounts = new Map<string, number>();

const runWithinFileWriteQueue = async <T>(path: string, action: () => Promise<T>): Promise<T> => {
	const previous = fileWriteQueues.get(path) ?? Promise.resolve();
	let release!: (value?: unknown) => void;
	fileWriteQueues.set(path, new Promise((resolve) => (release = resolve)));
	const prevCount = fileWriteQueueCounts.get(path) ?? 0;
	fileWriteQueueCounts.set(path, prevCount + 1);

	try {
		await previous;
		return await action();
	} finally {
		release();
		const remaining = fileWriteQueueCounts.get(path) ?? 1;
		if (remaining <= 1) {
			fileWriteQueues.delete(path);
			fileWriteQueueCounts.delete(path);
		} else {
			fileWriteQueueCounts.set(path, remaining - 1);
		}
	}
};

/**
 * Number of pending queued writes for a given resolved storage path. Used to
 * verify the per-file write queue drains (entries are removed once no writer
 * remains) rather than accumulating for the lifetime of the process.
 */
export const getPendingFileWrites = (path: StorageBaseType): number => {
	return fileWriteQueueCounts.get(buildStoragePath(path)) ?? 0;
};

export type ReadModifyWriteFileOperations = {
	read: (options: StorageBaseType) => Promise<string | undefined>;
	write: (data: string, options: StorageBaseType) => Promise<string>;
};

// the write already runs inside the file's queue slot, so it must not queue again
const defaultReadModifyWriteOperations: ReadModifyWriteFileOperations = {
	read: (options) => getFileFromStorage(options),
	write: (data, options) => writeFileToStorage(data, options),
};

/**
 * Serializes a read-modify-write of a single storage file so concurrent
 * updates to the same path cannot lose one another's changes. {@link modify}
 * receives the latest persisted plaintext (or undefined when absent) and must
 * return the next plaintext and the result to hand back to the caller. The
 * read, transform, and write all run inside one per-file queue slot, so each
 * write derives from the most recently persisted content. Different file paths
 * proceed concurrently.
 */
export const readModifyWriteFile = async <T>(
	options: StorageBaseType,
	modify: (current: string | undefined) => Promise<{ data: string; result: T }>,
	operations: Partial<ReadModifyWriteFileOperations> = {},
): Promise<T> => {
	const readsWrites = {
		...defaultReadModifyWriteOperations,
		...operations,
	};
	const destinationPath = buildStoragePath(options);

	return runWithinFileWriteQueue(destinationPath, async () => {
		const current = await readsWrites.read(options);
		const { data, result } = await modify(current);

		if (data !== current) {
			await readsWrites.write(data, options);
		}

		return result;
	});
};

export const listFilesFromStorage = async (
	options: StorageFileListOptions,
): Promise<StorageFileEntry[]> => {
	const backend = getStorageBackend();
	const objects = await backend.list(buildStoragePath(options));
	const includedPath = options.pathIncludes;
	const matchingObjects = includedPath
		? objects.filter((object) => object.name.includes(includedPath))
		: objects;

	return Promise.all(
		matchingObjects.map(async (object) => {
			const entry: StorageFileEntry = {
				path: object.name,
				updatedAt: object.updated,
			};

			if (options.includeContents) {
				entry.contents = decryptData((await backend.read(object.name)) ?? '');
			}

			return entry;
		}),
	);
};

export const deleteFileFromStorage = async (options: StorageBaseType) => {
	if (!options.path || options.path.length === 0) {
		return;
	}

	await getStorageBackend().deletePrefix(buildStoragePath(options, false));
};
