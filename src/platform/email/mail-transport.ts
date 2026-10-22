import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

export type SmtpServer = {
	host: string | undefined;
	port: number;
	secure: boolean;
};

// without a host the existing Gmail service is used; a self-hosted deployment
// can point at any SMTP server, with implicit TLS or STARTTLS
export const buildMailTransportOptions = (
	emailAddress: string | undefined,
	password: string | undefined,
	server?: SmtpServer,
) => {
	const connection: SMTPTransport.Options = server?.host
		? { host: server.host, port: server.port, secure: server.secure }
		: { service: 'gmail', secure: true };

	const transportOptions: SMTPTransport.Options = {
		...connection,
		requireTLS: true,
		auth: {
			user: emailAddress,
			pass: password,
		},
	};

	return transportOptions;
};
