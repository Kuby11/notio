/**
 * Заголовки межсервисного контекста.
 *
 * Источник истины — один: и gateway, и сервисы импортируют эти имена,
 * поэтому «магических строк» вроде 'x-user-id' в коде не остаётся.
 *
 * Gateway обязан **перезаписывать** эти заголовки, а не пересылать клиентские:
 * иначе любой, кто достучился до gateway, объявил бы себя другим пользователем.
 */
export const INTERNAL_HEADERS = {
  /** Сквозной идентификатор запроса. */
  REQUEST_ID: 'x-request-id',
  /** Идентификатор пользователя, определённый gateway. */
  ACTOR_ID: 'x-user-id',
  /** Служебная метка: из какого сервиса пришёл вызов. */
  SOURCE_SERVICE: 'x-notio-source',
} as const;

export type InternalHeaderName = (typeof INTERNAL_HEADERS)[keyof typeof INTERNAL_HEADERS];

/** Значение SOURCE_SERVICE, которым gateway помечает свои вызовы. */
export const GATEWAY_SOURCE = 'gateway';

/** Ответ сервиса помечается этой меткой — в тестах и логах видно источник. */
export const SERVICE_RESPONSE_HEADER = 'x-notio-served-by';
