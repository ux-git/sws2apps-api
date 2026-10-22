import 'dotenv/config';

import { applicationVersion } from './application.js';

type NodeEnvironment = 'development' | 'production' | 'test';

const readOptional = (name: string) => {
	const value = process.env[name]?.trim();
	return value || undefined;
};

const readRequired = (name: string) => {
	const value = readOptional(name);
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
};

const readUrl = (name: string) => {
	const value = readRequired(name);
	try {
		new URL(value);
		return value;
	} catch {
		throw new Error(`Environment variable ${name} must be a valid URL`);
	}
};

const readBoolean = (name: string, fallback = false) => {
	const value = readOptional(name);
	if (value === undefined) return fallback;
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new Error(`Environment variable ${name} must be either true or false`);
};

const readOrigins = (name: string) => {
	const value = readOptional(name);
	if (!value) return [];

	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => {
			try {
				return new URL(item).origin;
			} catch {
				throw new Error(`Environment variable ${name} must be a comma-separated list of origins`);
			}
		});
};

const readPort = () => {
	const value = readOptional('PORT');
	if (!value) return 8000;
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('Environment variable PORT must be an integer between 1 and 65535');
	}
	return port;
};

const nodeEnv = (readOptional('NODE_ENV') ?? 'development') as NodeEnvironment;
if (!['development', 'production', 'test'].includes(nodeEnv)) {
	throw new Error('Environment variable NODE_ENV must be development, production, or test');
}

const storageBackend = readOptional('STORAGE_BACKEND') ?? 'firebase';
if (!['firebase', 'filesystem'].includes(storageBackend)) {
	throw new Error('Environment variable STORAGE_BACKEND must be firebase or filesystem');
}

const mailEnabled = readBoolean('MAIL_ENABLED');
const encryptionKey = readOptional('SEC_ENCRYPT_KEY');

if (nodeEnv === 'production' && !encryptionKey) {
	throw new Error('Missing required production environment variable: SEC_ENCRYPT_KEY');
}

export const env = Object.freeze({
	nodeEnv,
	isDevelopment: nodeEnv === 'development',
	isProduction: nodeEnv === 'production',
	isTest: nodeEnv === 'test',
	port: readPort(),
	appVersion: applicationVersion,
	appCountryApi: readUrl('APP_COUNTRY_API'),
	appCongregationApi: readUrl('APP_CONGREGATION_API'),
	trustedOrigins: readOrigins('APP_TRUSTED_ORIGINS'),
	firebaseAppName: readRequired('FIREBASE_APP_NAME'),
	firebaseStorageBucket: readOptional('FIREBASE_STORAGE_BUCKET'),
	firebaseStorageSuffix: readOptional('FIREBASE_STORAGE_SUFFIX') ?? 'firebasestorage.app',
	firebaseAuthEmulatorHost: readOptional('FIREBASE_AUTH_EMULATOR_HOST'),
	googleConfigBase64: readOptional('GOOGLE_CONFIG_BASE64'),
	storageBackend: storageBackend as 'firebase' | 'filesystem',
	storageDirectory:
		storageBackend === 'filesystem' ? readRequired('STORAGE_DIRECTORY') : readOptional('STORAGE_DIRECTORY'),
	encryptionKey: encryptionKey ?? 'organized-local-development-only',
	mailEnabled,
	mailAddress: mailEnabled ? readRequired('MAIL_ADDRESS') : readOptional('MAIL_ADDRESS'),
	mailSenderName: mailEnabled ? readRequired('MAIL_SENDER_NAME') : readOptional('MAIL_SENDER_NAME'),
	mailPassword: mailEnabled ? readRequired('MAIL_PASSWORD') : readOptional('MAIL_PASSWORD'),
	logtailSourceToken: readOptional('LOGTAIL_SOURCE_TOKEN'),
	logtailIngestingHost: readOptional('LOGTAIL_INGESTING_HOST') ?? 'in.logs.betterstack.com',
	crowdinApiKey: readOptional('CROWDIN_API_KEY'),
	crowdinProjectId: readOptional('CROWDIN_PROJECT_ID'),
});

export type Environment = typeof env;
