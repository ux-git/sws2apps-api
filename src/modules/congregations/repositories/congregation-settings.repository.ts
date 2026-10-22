import { LogLevel } from '@logtail/types';

import {
	getFileFromStorage,
	getFileMetadata,
	uploadFileToStorage,
} from '#platform/firebase/storage.js';
import { logger } from '#platform/logging/logger.js';
import type { CongSettingsType } from '../types/congregations.types.js';
import { parseStoredLocalOnlySetting } from '../local-only-categories.js';

export const getCongregationSettings = async (cong_id: string) => {
	const data = await getFileFromStorage({ type: 'congregation', path: `${cong_id}/settings/main.txt` });

	if (!data) {
		logger(LogLevel.Warn, 'congregation settings not found', { service: 'firebase' });
		return;
	}

	const result: CongSettingsType = JSON.parse(data!);

	const localOnlyPath = { type: 'congregation' as const, path: `${cong_id}/settings/local_only.txt` };

	// a file that exists but cannot be decrypted or parsed is unreadable too
	if (await getFileMetadata(localOnlyPath)) {
		const localOnly = await getFileFromStorage(localOnlyPath);
		const { setting, readable } = parseStoredLocalOnlySetting(localOnly ?? '');

		if (!readable) {
			logger(LogLevel.Error, 'local-only setting unreadable, keeping all reports local-only', {
				service: 'firebase',
			});
		}

		result.local_only_categories = setting;
	}

	return result;
};

export const getCongregationFlags = async (cong_id: string) => {
	const data = await getFileFromStorage({ type: 'congregation', path: `${cong_id}/settings/flags.txt` });

	if (data) {
		const flags = JSON.parse(data) as string[];
		return flags;
	}

	return [];
};

// the local-only setting lives in its own file, so an API that predates it
// never serves it to clients and stays safe to roll back; it is only written
// when it changes
export const setCongregationSettings = async (
	id: string,
	settings: CongSettingsType,
	previous?: CongSettingsType,
) => {
	const { local_only_categories, ...mainSettings } = settings;

	const changed =
		JSON.stringify(local_only_categories) !== JSON.stringify(previous?.local_only_categories);

	// a fail-closed stand-in is only written together with a real change, which
	// replaces the unreadable file with every category still local-only
	if (local_only_categories && changed) {
		await uploadFileToStorage(JSON.stringify(local_only_categories), {
			type: 'congregation',
			path: `${id}/settings/local_only.txt`,
		});
	}

	const data = JSON.stringify(mainSettings);
	const path = `${id}/settings/main.txt`;
	await uploadFileToStorage(data, { type: 'congregation', path });
};

export const setCongregationFlags = async (id: string, flags: string[]) => {
	const data = JSON.stringify(flags);
	const path = `${id}/settings/flags.txt`;
	await uploadFileToStorage(data, { type: 'congregation', path });
};

export const getCongregationCreatedAt = async (cong_id: string) => {
	let createdAt: string | undefined;

	createdAt = await getFileFromStorage({ type: 'congregation', path: `${cong_id}/settings/created.txt` });

	if (!createdAt) {
		const createdAtDefault = await getFileMetadata({ type: 'congregation', path: `${cong_id}/settings/main.txt` });
		createdAt = createdAtDefault?.timeCreated || new Date().toISOString();

		await setCongregationCreatedAt(cong_id, createdAt!);
	}

	return createdAt;
};

export const setCongregationCreatedAt = async (id: string, data: string) => {
	const path = `${id}/settings/created.txt`;
	await uploadFileToStorage(data, { type: 'congregation', path });
};
