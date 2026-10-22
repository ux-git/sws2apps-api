import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMailTransportOptions } from '#platform/email/mail-transport.js';

describe('email transport security', () => {
	it('uses an encrypted SMTP connection with the configured credentials', () => {
		const options = buildMailTransportOptions('sender@example.com', 'secret');

		assert.equal(options.secure, true);
		assert.deepEqual(options.auth, {
			user: 'sender@example.com',
			pass: 'secret',
		});
	});

	it('does not disable TLS certificate validation', () => {
		const options = buildMailTransportOptions('sender@example.com', 'secret');

		assert.equal(options.tls?.rejectUnauthorized, undefined);
	});

	it('keeps Gmail when no SMTP host is configured', () => {
		const options = buildMailTransportOptions('sender@example.com', 'secret', {
			host: undefined,
			port: 465,
			secure: true,
		});

		assert.equal(options.service, 'gmail');
	});

	it('connects to a configured SMTP server and still requires TLS', () => {
		const options = buildMailTransportOptions('sender@example.com', 'secret', {
			host: 'smtp.example.com',
			port: 587,
			secure: false,
		});

		assert.equal(options.service, undefined);
		assert.equal(options.host, 'smtp.example.com');
		assert.equal(options.port, 587);
		assert.equal(options.secure, false);
		assert.equal(options.requireTLS, true);
	});
});
