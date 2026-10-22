import { randomUUID } from 'node:crypto';
import { mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import type { StorageBackend, StorageObject } from './storage-backend.types.js';

const isMissing = (error: unknown) => {
	const code = (error as NodeJS.ErrnoException).code;
	return code === 'ENOENT' || code === 'ENOTDIR';
};

const toObjectName = (root: string, filePath: string) => {
	return relative(root, filePath).split(sep).join('/');
};

const walkFiles = async (directory: string): Promise<string[]> => {
	let entries;

	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch (error) {
		if (isMissing(error)) return [];
		throw error;
	}

	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) return walkFiles(entryPath);
			if (entry.isFile() && !entry.name.endsWith('.tmp')) return [entryPath];

			return [];
		}),
	);

	return files.flat();
};

/**
 * Stores objects as files under one directory, for self-hosted deployments
 * without a cloud bucket. Writes go to a temporary file that is flushed and
 * then renamed, so a crash never leaves a half-written object.
 */
export const createFilesystemStorage = (directory: string): StorageBackend => {
	const root = resolve(directory);

	const resolveObjectPath = (path: string) => {
		const filePath = resolve(root, path);

		if (filePath !== root && !filePath.startsWith(root + sep)) {
			throw new Error(`Storage path escapes the storage directory: ${path}`);
		}

		return filePath;
	};

	const statFile = async (path: string) => {
		try {
			const stats = await stat(resolveObjectPath(path));
			return stats.isFile() ? stats : undefined;
		} catch (error) {
			if (isMissing(error)) return undefined;
			throw error;
		}
	};

	return {
		save: async (path, data) => {
			const filePath = resolveObjectPath(path);
			const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

			await mkdir(dirname(filePath), { recursive: true });

			const file = await open(temporaryPath, 'w');

			try {
				await file.writeFile(data, 'utf8');
				await file.sync();
			} finally {
				await file.close();
			}

			await rename(temporaryPath, filePath);
		},

		read: async (path) => {
			if (!(await statFile(path))) return undefined;

			return readFile(resolveObjectPath(path), 'utf8');
		},

		metadata: async (path) => {
			const stats = await statFile(path);

			if (!stats) return undefined;

			return {
				updated: stats.mtime.toISOString(),
				timeCreated: stats.birthtime.toISOString(),
			};
		},

		list: async (prefix) => {
			const prefixPath = resolveObjectPath(prefix);
			const directory = prefix.endsWith('/') ? prefixPath : dirname(prefixPath);
			const files = await walkFiles(directory);

			const objects = await Promise.all(
				files
					.map((filePath) => toObjectName(root, filePath))
					.filter((name) => name.startsWith(prefix))
					.map(async (name): Promise<StorageObject | undefined> => {
						const stats = await statFile(name);
						return stats ? { name, updated: stats.mtime.toISOString() } : undefined;
					}),
			);

			return objects.filter((object): object is StorageObject => object !== undefined);
		},

		deletePrefix: async (prefix) => {
			const prefixPath = resolveObjectPath(prefix);
			const directory = prefix.endsWith('/') ? prefixPath : dirname(prefixPath);
			const files = await walkFiles(directory);

			await Promise.all(
				files
					.filter((filePath) => toObjectName(root, filePath).startsWith(prefix))
					.map((filePath) => rm(filePath, { force: true })),
			);
		},
	};
};
