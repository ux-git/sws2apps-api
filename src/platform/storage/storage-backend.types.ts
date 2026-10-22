export type StorageObjectMetadata = {
	updated: string;
	timeCreated: string;
	contentType?: string;
};

export type StorageObject = {
	name: string;
	updated: string;
};

/**
 * Raw object storage keyed by a resolved path such as
 * `v3/congregations/<id>/settings/main.txt`. Prefixes follow object-store
 * semantics: plain string prefixes, not directories.
 */
export type StorageBackend = {
	save: (path: string, data: string) => Promise<void>;
	read: (path: string) => Promise<string | undefined>;
	metadata: (path: string) => Promise<StorageObjectMetadata | undefined>;
	list: (prefix: string) => Promise<StorageObject[]>;
	deletePrefix: (prefix: string) => Promise<void>;
};
