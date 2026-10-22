import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	mapProviderLocation,
	normalizeIpLocation,
	retrieveVisitorDetails,
} from '#platform/visitor-details/visitor-details.js';

describe('visitor location adapter', () => {
	it('maps provider-specific fields into the application location shape', () => {
		const providerData = {
			continentCode: 'AF',
			countryName: 'Madagascar',
			countryCode: 'MG',
			cityName: 'Antananarivo',
			timeZones: ['Indian/Antananarivo'],
		};

		const location = mapProviderLocation(providerData, {
			continentCode: 'continent_code',
			countryName: 'country_name',
			countryCode: 'country_code',
			cityName: 'city',
			timeZones: 'timezone',
		});

		assert.deepEqual(location, {
			continent_code: 'AF',
			country_name: 'Madagascar',
			country_code: 'MG',
			city: 'Antananarivo',
			timezone: ['Indian/Antananarivo'],
		});
	});

	it('prefers an ISO-3 country code and preserves missing-field fallbacks', () => {
		const location = normalizeIpLocation({
			country_code: 'MG',
			country_code_iso3: 'MDG',
		});

		assert.deepEqual(location, {
			continent_code: '',
			country_name: '',
			country_code: 'MDG',
			city: '',
			timezone: '',
		});
	});

	it('leaves the location empty without contacting a lookup service when turned off', async () => {
		const details = await retrieveVisitorDetails(
			'203.0.113.10',
			{ 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
			false,
		);

		assert.deepEqual(details.ipLocation, {
			continent_code: '',
			country_name: '',
			country_code: '',
			city: '',
			timezone: '',
		});
		assert.equal(details.ip, '203.0.113.10');
	});
});
