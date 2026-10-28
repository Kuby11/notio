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
        `Отправка письма (${kind}) не настроена: подключите Email Sending или внешнего провайдера`,
      );
    },
  };
}
