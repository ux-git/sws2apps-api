import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeAppModulesSetting } from '#modules/congregations/index.js';

describe('app modules setting', () => {
	it('keeps only known modules with a valid method and clamps timestamps', () => {
		const now = Date.parse('2026-10-22T00:00:00.000Z');

		assert.deepEqual(
			sanitizeAppModulesSetting(
				{
					field_service_reports: { enabled: true, sync: 'local', updatedAt: '2026-02-01T00:00:00.000Z' },
					meeting_attendance: { enabled: false, sync: 'server', updatedAt: '2099-01-01T00:00:00.000Z' },
					branch_reports: { enabled: true, sync: 'cloud', updatedAt: '2026-02-01T00:00:00.000Z' },
					territories: { enabled: true, sync: 'local', updatedAt: '2026-02-01T00:00:00.000Z' },
				},
				now,
			),
			{
				field_service_reports: { enabled: true, sync: 'local', updatedAt: '2026-02-01T00:00:00.000Z' },
				meeting_attendance: { enabled: false, sync: 'server', updatedAt: '2026-10-22T00:00:00.000Z' },
			},
		);
		assert.equal(sanitizeAppModulesSetting([]), undefined);
	});
});
