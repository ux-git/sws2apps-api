import type { CongSettingsType } from './types/congregations.types.js';

export const LOCAL_ONLY_CATEGORIES = [
	'cong_field_service_reports',
	'branch_field_service_reports',
	'branch_cong_analysis',
] as const;

export type LocalOnlyCategory = (typeof LOCAL_ONLY_CATEGORIES)[number];

export type LocalOnlySetting = Partial<
	Record<LocalOnlyCategory, { value: boolean; updatedAt: string }>
>;

export const getLocalOnlyCategories = (settings: CongSettingsType): LocalOnlyCategory[] => {
	const setting = settings.local_only_categories;

	if (!setting || typeof setting !== 'object') return [];

	return LOCAL_ONLY_CATEGORIES.filter((category) => setting[category]?.value === true);
};

export const isLocalOnlyCategory = (
	settings: CongSettingsType,
	category: LocalOnlyCategory,
): boolean => {
	return getLocalOnlyCategories(settings).includes(category);
};

const FAIL_CLOSED_UPDATED_AT = new Date(0).toISOString();

// used when the stored setting cannot be read: keep everything off the server
// until an admin saves the setting again
export const getFailClosedLocalOnlySetting = (): LocalOnlySetting => {
	return Object.fromEntries(
		LOCAL_ONLY_CATEGORIES.map((category) => [
			category,
			{ value: true, updatedAt: FAIL_CLOSED_UPDATED_AT },
		]),
	);
};

// sent beside the settings rather than inside them, so older apps never store
// it and send it back; its presence tells newer apps the API understands it
export const getLocalOnlySetting = (settings: CongSettingsType): LocalOnlySetting => {
	return sanitizeLocalOnlySetting(settings.local_only_categories) ?? {};
};

/**
 * Keeps only known categories, each with a boolean and a valid timestamp
 * normalised to ISO and clamped to the server clock, so a malformed or
 * far-future entry can never reach storage.
 */
export const sanitizeLocalOnlySetting = (
	setting: unknown,
	now = Date.now(),
): LocalOnlySetting | undefined => {
	if (!setting || typeof setting !== 'object' || Array.isArray(setting)) return undefined;

	const result: LocalOnlySetting = {};

	for (const category of LOCAL_ONLY_CATEGORIES) {
		const entry = (setting as Record<string, unknown>)[category];

		if (!entry || typeof entry !== 'object') continue;

		const { value, updatedAt } = entry as Record<string, unknown>;

		if (typeof value !== 'boolean' || typeof updatedAt !== 'string') continue;

		const timestamp = Date.parse(updatedAt);

		if (Number.isNaN(timestamp)) continue;

		result[category] = {
			value,
			updatedAt: new Date(Math.min(timestamp, now)).toISOString(),
		};
	}

	return result;
};

// reads the stored file; anything unreadable keeps all reports off the server
export const parseStoredLocalOnlySetting = (
	raw: string,
): { setting: LocalOnlySetting; readable: boolean } => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		parsed = undefined;
	}

	const setting = sanitizeLocalOnlySetting(parsed);

	// every stored category entry must survive validation, or none is trusted
	const storedCategories =
		parsed && typeof parsed === 'object'
			? Object.keys(parsed).filter((key) => (LOCAL_ONLY_CATEGORIES as readonly string[]).includes(key))
			: [];

	if (setting && Object.keys(setting).length === storedCategories.length) {
		return { setting, readable: true };
	}

	return { setting: getFailClosedLocalOnlySetting(), readable: false };
};

// clients from before the setting still report versions for local-only data;
// those versions must not block the rest of their upload
export const omitLocalOnlyMetadata = (
	metadata: Record<string, string>,
	settings: CongSettingsType,
): Record<string, string> => {
	const localOnly: string[] = getLocalOnlyCategories(settings);

	// the S-4 queue no longer syncs through backups; queued reports reach the
	// secretary through the updates endpoint
	if (localOnly.includes('cong_field_service_reports')) {
		localOnly.push('incoming_reports');
	}

	return Object.fromEntries(
		Object.entries(metadata).filter(([key]) => !localOnly.includes(key)),
	);
};
