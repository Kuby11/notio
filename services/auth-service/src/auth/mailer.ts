/**
 * Port for sending emails.
 *
 * The service knows nothing about SMTP, Email Workers or providers: it hands
 * the recipient a link. The transport is swapped in the composition root.
 */
export interface MailSender {
  send(message: OutboundMail): Promise<void>;
}

export interface OutboundMail {
  to: string;
  subject: string;
  /** Action link: email confirmation, password reset, magic link. */
  actionUrl: string;
  kind: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
}

/**
 * Dev implementation: the email is not sent, its link is written to the log.
 * That lets a developer walk the verification flow without an external provider.
 */
export function createLoggingMailSender(log: (message: string) => void): MailSender {
  return {
    send: async ({ to, actionUrl, kind }) => {
      log(
        JSON.stringify({
          level: 'info',
          service: 'auth-service',
          event: 'outbound_mail',
          kind,
          to,
          actionUrl,
        }),
      );
    },
  };
}

/**
 * Production stub: fails honestly instead of "successfully" sending a letter
 * nobody will receive and leaving the user unconfirmed.
 */
export function createUnconfiguredMailSender(): MailSender {
  return {
    send: async ({ kind }) => {
      throw new Error(
        `Mail sending (${kind}) is not configured: connect Email Sending or an external provider`,
      );
    },
  };
}

const EMAILJS_API = 'https://api.emailjs.com/api/v1.0/email/send';

/** Subjects for the two letters the service sends. */
const EMAILJS_SUBJECTS: Record<OutboundMail['kind'], string> = {
  VERIFY_EMAIL: 'Confirm your email for notio',
  RESET_PASSWORD: 'Reset your password for notio',
};

/** The lead line of the letter: what happened and how long the link lives. */
const EMAILJS_LEADS: Record<OutboundMail['kind'], string> = {
  VERIFY_EMAIL:
    'Confirm your email address by clicking the button below. The link is valid for 24 hours.',
  RESET_PASSWORD:
    'You requested a password reset — click the button below. The link is valid for 1 hour.',
};

/**
 * Real transport: EmailJS over its REST API (a server call, so the private
 * key — accessToken — is required along with the public one).
 *
 * The letter's look lives in the EmailJS template; the service only hands it
 * variables. The template must use them:
 * `To` = {{to_email}}, the body may include {{message}}, {{subject}} and
 * {{action_url}} (see emailjs-template.html).
 *
 * `fetch` is injectable for tests. A provider failure rejects the send —
 * Better Auth surfaces it instead of pretending the letter is on its way.
 */
export function createEmailJSMailSender(
  options: {
    serviceId: string;
    templateId: string;
    publicKey: string;
    privateKey: string;
  },
  fetchFn: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): MailSender {
  return {
    send: async ({ to, subject, actionUrl, kind }) => {
      const response = await fetchFn(EMAILJS_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          service_id: options.serviceId,
          template_id: options.templateId,
          user_id: options.publicKey,
          accessToken: options.privateKey,
          template_params: {
            to_email: to,
            subject: subject || EMAILJS_SUBJECTS[kind],
            action_url: actionUrl,
            message: EMAILJS_LEADS[kind],
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');

        throw new Error(
          `EmailJS rejected the email (${kind}, ${String(response.status)}): ${detail.slice(0, 300)}`,
        );
      }
    },
  };
}
