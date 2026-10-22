import { randomUUID } from 'node:crypto';
import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { env } from '#config/env.js';
import { getFileFromStorage, readModifyWriteFile } from './storage.js';

export type DocumentStoreRecord = {
	id: string;
	data: Record<string, unknown>;
};

// with the filesystem backend a collection is one encrypted file, so a
// self-hosted deployment needs no Firestore
const collectionFile = (collectionName: string) => ({
	type: 'api' as const,
	path: `collections/${collectionName}.json`,
});

const parseCollection = (contents: string | undefined): DocumentStoreRecord[] => {
	return contents ? (JSON.parse(contents) as DocumentStoreRecord[]) : [];
};

const modifyCollectionFile = async (
	collectionName: string,
	modify: (records: DocumentStoreRecord[]) => DocumentStoreRecord[],
): Promise<DocumentStoreRecord[]> => {
	return readModifyWriteFile(collectionFile(collectionName), async (current) => {
		const records = modify(parseCollection(current));
		return { data: JSON.stringify(records), result: records };
	});
};

const usesFilesystem = () => env.storageBackend === 'filesystem';

export const getCollectionRecords = async (
	collectionName: string,
): Promise<DocumentStoreRecord[]> => {
	if (usesFilesystem()) {
		return parseCollection(await getFileFromStorage(collectionFile(collectionName)));
	}

	const database = getFirestore(getApp());
	const snapshot = await database.collection(collectionName).get();

	return snapshot.docs.map((document) => ({
		id: document.id,
		data: document.data(),
	}));
};

export const getFirstCollectionRecord = async (
	collectionName: string,
): Promise<DocumentStoreRecord | undefined> => {
	if (usesFilesystem()) {
		const records = await getCollectionRecords(collectionName);
		return records[0];
	}

	const database = getFirestore(getApp());
	const snapshot = await database.collection(collectionName).limit(1).get();
	const document = snapshot.docs[0];

	if (!document) return undefined;

	return {
		id: document.id,
		data: document.data(),
	};
};

export const addCollectionRecord = async (
	collectionName: string,
	data: Record<string, unknown>,
): Promise<void> => {
	if (usesFilesystem()) {
		await modifyCollectionFile(collectionName, (records) => [
			...records,
			{ id: randomUUID(), data },
		]);
		return;
	}

	const database = getFirestore(getApp());
	await database.collection(collectionName).add(data);
};

export const updateCollectionRecord = async (
	collectionName: string,
	documentId: string,
	data: Record<string, unknown>,
): Promise<void> => {
	if (usesFilesystem()) {
		await modifyCollectionFile(collectionName, (records) => {
			if (!records.some((record) => record.id === documentId)) {
				throw new Error(`Document ${documentId} not found in ${collectionName}`);
			}

			return records.map((record) =>
				record.id === documentId ? { id: record.id, data: { ...record.data, ...data } } : record,
			);
		});
		return;
	}

	const database = getFirestore(getApp());
	await database.collection(collectionName).doc(documentId).update(data);
};
