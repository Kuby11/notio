'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useTransition } from 'react';
import { LOCALE_COOKIE_NAME, LOCALES } from '@/i18n/config';
import {
  DATE_FORMATS,
  NUMBER_FORMATS,
  SAMPLE_DATE,
  SAMPLE_NUMBER,
  START_PAGES,
  formatDate,
  formatNumber,
  isDateFormat,
  isNumberFormat,
  isStartPage,
  resolveTimeZone,
  timeZoneOffsetLabel,
  timeZoneOptions,
  type RegionalPreferences,
} from '../../preferences/preferences';
import { usePreferences } from '../../preferences/preferences.store';
import { Switch } from '@/shared/ui/switch';
import { THEME_CHOICES, applyTheme } from '../theme';
import { SettingsGroup, SettingsRow, SettingsSelect } from './settings-layout';

/**
 * Preferences: everything a user tunes about the interface — theme, language,
 * time zone, number and date formats, and the page a workspace opens on.
 *
 * Theme and regional values are browser settings (localStorage); the language
 * is a cookie read by the server, so switching it refreshes the page.
 */
export function PreferencesSection() {
  const t = useTranslations('settings.preferences');
  const locale = useLocale();
  const router = useRouter();
  const [, startLocaleTransition] = useTransition();
  const preferences = usePreferences();
  const zones = useMemo(() => timeZoneOptions(), []);
  const effectiveZone = resolveTimeZone(preferences);

  // "System" keeps following the device while it is selected.
  useEffect(() => {
    if (preferences.theme !== 'system' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');

    media.addEventListener('change', onChange);

    return () => media.removeEventListener('change', onChange);
  }, [preferences.theme]);

  function pickLocale(next: (typeof LOCALES)[number]): void {
    if (next === locale) {
      return;
    }

    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
    startLocaleTransition(() => router.refresh());
  }

  /** Formats depend only on the regional part of the preferences. */
  const regional: RegionalPreferences = {
    autoTimeZone: preferences.autoTimeZone,
    timeZone: preferences.timeZone,
    numberFormat: preferences.numberFormat,
    dateFormat: preferences.dateFormat,
    startPage: preferences.startPage,
  };

  const themeOptions = THEME_CHOICES.map((choice) => ({
    value: choice,
    label: t(`theme.${choice}`),
  }));
  const languageOptions = LOCALES.map((code) => ({
    value: code,
    label: t(`language.${code}`),
  }));
  const zoneOptions = zones.map((zone) => {
    const offset = timeZoneOffsetLabel(zone);

    return { value: zone, label: offset.length > 0 ? `${offset} ${zone}` : zone };
  });
  const numberOptions = NUMBER_FORMATS.map((choice) => ({
    value: choice,
    label: formatNumber(SAMPLE_NUMBER, { ...regional, numberFormat: choice }),
  }));
  const dateOptions = DATE_FORMATS.map((choice) => ({
    value: choice,
    label: formatDate(SAMPLE_DATE, { ...regional, dateFormat: choice }, locale),
  }));
  const startOptions = START_PAGES.map((choice) => ({
    value: choice,
    label: t(`startPage.${choice}`),
  }));

  return (
    <div className="flex flex-col gap-10">
      <SettingsGroup title={t('groups.appearance')}>
        <SettingsRow label={t('theme.label')} hint={t('theme.hint')}>
          <SettingsSelect
            label={t('theme.label')}
            value={preferences.theme}
            options={themeOptions}
            onValueChange={(next) => {
              const choice = THEME_CHOICES.find((value) => value === next);

              if (choice) {
                preferences.setTheme(choice);
              }
            }}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t('groups.languageTime')}>
        <SettingsRow label={t('language.label')} hint={t('language.hint')}>
          <SettingsSelect
            label={t('language.label')}
            value={locale}
            options={languageOptions}
            onValueChange={(next) => {
              const code = LOCALES.find((value) => value === next);

              if (code) {
                pickLocale(code);
              }
            }}
          />
        </SettingsRow>

        <SettingsRow
          label={t('timeZone.auto')}
          hint={
            preferences.autoTimeZone
              ? t('timeZone.autoHint', { zone: effectiveZone })
              : t('timeZone.manualHint')
          }
        >
          <Switch
            aria-label={t('timeZone.auto')}
            checked={preferences.autoTimeZone}
            onCheckedChange={preferences.setAutoTimeZone}
          />
        </SettingsRow>

        <SettingsRow label={t('timeZone.label')} hint={t('timeZone.hint')}>
          <SettingsSelect
            label={t('timeZone.label')}
            value={effectiveZone}
            options={zoneOptions}
            disabled={preferences.autoTimeZone}
            onValueChange={preferences.setTimeZone}
            className="w-64"
          />
        </SettingsRow>

        <SettingsRow
          label={t('numberFormat.label')}
          hint={
            <>
              {t('numberFormat.hint')}
              <span className="mt-0.5 block">
                {t('numberFormat.example', { value: formatNumber(SAMPLE_NUMBER, regional) })}
              </span>
            </>
          }
        >
          <SettingsSelect
            label={t('numberFormat.label')}
            value={preferences.numberFormat}
            options={numberOptions}
            onValueChange={(next) => {
              if (isNumberFormat(next)) {
                preferences.setNumberFormat(next);
              }
            }}
          />
        </SettingsRow>

        <SettingsRow
          label={t('dateFormat.label')}
          hint={
            <>
              {t('dateFormat.hint')}
              <span className="mt-0.5 block">
                {t('dateFormat.example', { value: formatDate(SAMPLE_DATE, regional, locale) })}
              </span>
            </>
          }
        >
          <SettingsSelect
            label={t('dateFormat.label')}
            value={preferences.dateFormat}
            options={dateOptions}
            onValueChange={(next) => {
              if (isDateFormat(next)) {
                preferences.setDateFormat(next);
              }
            }}
          />
        </SettingsRow>

        <SettingsRow label={t('startPage.label')} hint={t('startPage.hint')}>
          <SettingsSelect
            label={t('startPage.label')}
            value={preferences.startPage}
            options={startOptions}
            onValueChange={(next) => {
              if (isStartPage(next)) {
                preferences.setStartPage(next);
              }
            }}
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
