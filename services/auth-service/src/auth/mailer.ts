/**
 * Порт отправки писем.
 *
 * Сервис не знает про SMTP, Email Workers или провайдеров: он отдаёт
 * получателю и ссылку. Транспорт подменяется в composition root.
 */
export interface MailSender {
  send(message: OutboundMail): Promise<void>;
}

export interface OutboundMail {
  to: string;
  subject: string;
  /** Ссылка действия: подтверждение почты, сброс пароля, вход по ссылке. */
  actionUrl: string;
  /** Тип действия для текста письма и для логов. */
  kind: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
}

/**
 * Dev-реализация: письмо не отправляется, а его ссылка пишется в лог.
 * Так разработчик может пройти флоу верификации без внешнего провайдера.
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
 * Production-заглушка: честно падает, вместо того чтобы «успешно» отправить
 * письмо, которое никто не получит, и оставить пользователя без подтверждения.
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
