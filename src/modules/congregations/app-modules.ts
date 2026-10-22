export const APP_MODULES = [
	'field_service_reports',
	'publisher_records',
	'branch_reports',
	'meeting_attendance',
] as const;

export type AppModuleId = (typeof APP_MODULES)[number];

export const MODULE_SYNC_METHODS = ['server', 'local', 'device'] as const;

export type ModuleSyncMethod = (typeof MODULE_SYNC_METHODS)[number];

export type AppModuleEntry = { enabled: boolean; sync: ModuleSyncMethod; updatedAt: string };

export type AppModulesSetting = Partial<Record<AppModuleId, AppModuleEntry>>;

/**
 * Keeps only known modules with a valid shape and an ISO timestamp clamped
 * to the server clock. The server stores the choice for every device; the
 * matching local-only categories carry the enforcement.
 */
export const sanitizeAppModulesSetting = (
	setting: unknown,
	now = Date.now(),
): AppModulesSetting | undefined => {
	if (!setting || typeof setting !== 'object' || Array.isArray(setting)) return undefined;

	const result: AppModulesSetting = {};

	for (const module of APP_MODULES) {
		const entry = (setting as Record<string, unknown>)[module];

		if (!entry || typeof entry !== 'object') continue;

		const { enabled, sync, updatedAt } = entry as Record<string, unknown>;

		if (typeof enabled !== 'boolean' || typeof updatedAt !== 'string') continue;
		if (!MODULE_SYNC_METHODS.includes(sync as ModuleSyncMethod)) continue;

		const timestamp = Date.parse(updatedAt);

		if (Number.isNaN(timestamp)) continue;

		result[module] = {
			enabled,
			sync: sync as ModuleSyncMethod,
			updatedAt: new Date(Math.min(timestamp, now)).toISOString(),
		};
	}

	return result;
};
