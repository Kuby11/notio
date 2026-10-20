/**
 * Ошибка HTTP-ответа с сохранённым статусом.
 *
 * Сеть и UI различают 4xx и 5xx по статусу, а не по тексту сообщения:
 * например, 429 нельзя повторять, иначе retry только усиливает rate limit.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
