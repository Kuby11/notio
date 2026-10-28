import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, LOCALES } from './config';

/**
 * Request configuration: the locale comes from the NEXT_LOCALE cookie set by
 * the language switcher. The URL carries no locale prefix, so next-intl's
 * locale-based routing is not used.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get(LOCALE_COOKIE_NAME)?.value;
  const locale = LOCALES.find((value) => value === requested) ?? DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
