import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findBackupMetadataConflict } from '#modules/backups/index.js';
import { Congregation } from '#modules/congregations/congregation.js';
import {
	getLocalOnlyCategories,
	parseStoredLocalOnlySetting,
	omitLocalOnlyMetadata,
	sanitizeLocalOnlySetting,
} from '#modules/congregations/index.js';

describe('local-only congregation categories', () => {
	it('keeps only known categories that are switched on', () => {
		const congregation = new Congregation('congregation-1');
		congregation.settings.local_only_categories = {
			...({ persons: { value: true, updatedAt: '2026-02-01T00:00:00.000Z' } } as object),
			branch_cong_analysis: { value: true, updatedAt: '2026-02-01T00:00:00.000Z' },
			cong_field_service_reports: { value: false, updatedAt: '2026-02-01T00:00:00.000Z' },
		};

		assert.deepEqual(getLocalOnlyCategories(congregation.settings), ['branch_cong_analysis']);
	});

	it('treats a malformed stored value as no local-only categories', () => {
		const congregation = new Congregation('congregation-1');
		congregation.settings.local_only_categories = 'cong_field_service_reports' as never;

		assert.deepEqual(getLocalOnlyCategories(congregation.settings), []);
	});

	it('sanitizes an incoming setting before it can be stored', () => {
		const now = Date.parse('2026-10-21T00:00:00.000Z');

		assert.deepEqual(
			sanitizeLocalOnlySetting(
				{
					cong_field_service_reports: { value: true, updatedAt: '2026-02-01T00:00:00.000Z', extra: 1 },
					persons: { value: true, updatedAt: '2026-02-01T00:00:00.000Z' },
					branch_cong_analysis: { value: 'yes', updatedAt: '2026-02-01T00:00:00.000Z' },
					branch_field_service_reports: { value: false, updatedAt: 'yesterday' },
				},
				now,
			),
			{ cong_field_service_reports: { value: true, updatedAt: '2026-02-01T00:00:00.000Z' } },
		);
		assert.equal(sanitizeLocalOnlySetting('cong_field_service_reports'), undefined);
	});

	it('normalises timestamps to ISO and clamps them to the server clock', () => {
		const now = Date.parse('2026-10-21T00:00:00.000Z');

		assert.deepEqual(
			sanitizeLocalOnlySetting(
				{
					cong_field_service_reports: { value: true, updatedAt: '2099-01-01T00:00:00.000Z' },
					branch_cong_analysis: { value: true, updatedAt: 'Sat, 01 Jan 2000 00:00:00 GMT' },
				},
				now,
			),
			{
				cong_field_service_reports: { value: true, updatedAt: '2026-10-21T00:00:00.000Z' },
				branch_cong_analysis: { value: true, updatedAt: '2000-01-01T00:00:00.000Z' },
			},
		);
	});

	it('lets an outdated client upload once its stale versions are local-only', () => {
		const congregation = new Congregation('congregation-1');
		congregation.settings.local_only_categories = {
			cong_field_service_reports: { value: true, updatedAt: '2026-02-01T00:00:00.000Z' },
		};
		const current = {
			cong_field_service_reports: '2026-03-01T00:00:00.000Z',
			persons: '2026-01-01T00:00:00.000Z',
		};
		const incoming = {
			cong_field_service_reports: '2026-01-01T00:00:00.000Z',
			persons: '2026-01-01T00:00:00.000Z',
		};

		assert.ok(findBackupMetadataConflict(current, incoming));
		assert.equal(
			findBackupMetadataConflict(current, omitLocalOnlyMetadata(incoming, congregation.settings)),
			undefined,
		);
	});

	it('keeps syncing the secretary once the S-4 queue version is no longer served', () => {
		const congregation = new Congregation('congregation-1');
		congregation.settings.local_only_categories = {
			cong_field_service_reports: { value: true, updatedAt: '2026-02-01T00:00:00.000Z' },
		};
		// fetching the queue moved its version, which the backup no longer serves
		const current = {
			incoming_reports: '2026-02-01T00:00:01.000Z',
			persons: '2026-01-01T00:00:00.000Z',
		};
		const secretaryHeader = {
			incoming_reports: '2026-01-15T00:00:00.000Z',
			persons: '2026-01-01T00:00:00.000Z',
		};

		assert.equal(
			findBackupMetadataConflict(
				current,
				omitLocalOnlyMetadata(secretaryHeader, congregation.settings),
			),
			undefined,
		);
	});

	it('keeps every category local-only when the stored setting cannot be read', () => {
		for (const raw of [
			'{broken',
			'null',
			'"x"',
			'[]',
			'{"branch_cong_analysis":{"value":true,"updatedAt":"yesterday"}}',
		]) {
			const { setting, readable } = parseStoredLocalOnlySetting(raw);
			const congregation = new Congregation('congregation-1');
			congregation.settings.local_only_categories = setting;

			assert.equal(readable, false, raw);

			assert.deepEqual(getLocalOnlyCategories(congregation.settings), [
				'cong_field_service_reports',
				'branch_field_service_reports',
				'branch_cong_analysis',
			]);
		}

		const stored = parseStoredLocalOnlySetting(
			'{"branch_cong_analysis":{"value":true,"updatedAt":"2026-02-01T00:00:00.000Z"}}',
		);

		assert.equal(stored.readable, true);
		assert.deepEqual(getLocalOnlyCategories({ local_only_categories: stored.setting } as never), [
			'branch_cong_analysis',
		]);
	});

});
