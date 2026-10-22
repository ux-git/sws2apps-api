import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CongSettingsType } from '#modules/congregations/index.js';

const shouldRunFirebaseTests = process.env.RUN_FIREBASE_EMULATOR_TESTS === 'true';

test(
	'congregation settings keep the local-only setting out of the main settings file',
	{ skip: !shouldRunFirebaseTests },
	async () => {
		assert.match(
			process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '',
			/^(127\.0\.0\.1|localhost):\d+$/,
			'Firebase integration tests may only use a local Storage emulator',
		);

		await import('#platform/firebase/firebase-app.js');

		const { deleteFileFromStorage, getFileFromStorage } = await import(
			'#platform/firebase/storage.js'
		);
		const { getCongregationSettings, setCongregationSettings } = await import(
			'#modules/congregations/repositories/congregation-settings.repository.js'
		);

		const congregationId = `integration-tests-${process.pid}-${Date.now()}`;
		const settings = {
			cong_name: 'Central',
			local_only_categories: {
				cong_field_service_reports: { value: true, updatedAt: '2026-02-01T00:00:00.000Z' },
			},
		} as unknown as CongSettingsType;

		try {
			await setCongregationSettings(congregationId, settings);

			const mainFile = await getFileFromStorage({
				type: 'congregation',
				path: `${congregationId}/settings/main.txt`,
			});

			assert.deepEqual(JSON.parse(mainFile!), { cong_name: 'Central' });
			assert.deepEqual(await getCongregationSettings(congregationId), settings);
		} finally {
			await deleteFileFromStorage({ type: 'congregation', path: congregationId });
		}
	},
);
