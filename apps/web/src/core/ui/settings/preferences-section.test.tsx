// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../../../messages/en.json';
import { usePreferencesStore } from '../../preferences/preferences.store';
import { PreferencesSection } from './preferences-section';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn<() => void>(),
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<() => void>(),
  }),
}));

function renderSection() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PreferencesSection />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  usePreferencesStore.setState({
    theme: 'system',
    autoTimeZone: true,
    timeZone: '',
    numberFormat: 'en-US',
    dateFormat: 'dmy',
    startPage: 'home',
    hydrated: true,
  });
});

describe('секция предпочтений', () => {
  it('даёт выбрать часовой пояс только при выключенном автоопределении', async () => {
    const user = userEvent.setup();

    renderSection();

    const zoneSelect = screen.getByLabelText('Time zone');

    expect(zoneSelect).toBeDisabled();

    await user.click(screen.getByRole('switch', { name: 'Set automatically' }));

    expect(screen.getByLabelText('Time zone')).toBeEnabled();
  });

  it('показывает пример в выбранном формате чисел', async () => {
    const user = userEvent.setup();

    renderSection();

    expect(screen.getByText('Example: 1,234,567.89')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Number format'));
    await user.click(await screen.findByRole('option', { name: '1.234.567,89' }));

    expect(screen.getByText('Example: 1.234.567,89')).toBeInTheDocument();
  });

  it('показывает пример в выбранном формате даты', async () => {
    const user = userEvent.setup();

    renderSection();

    expect(screen.getByText('Example: 26.10.2026')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Date format'));
    await user.click(await screen.findByRole('option', { name: '2026-10-26' }));

    expect(screen.getByText('Example: 2026-10-26')).toBeInTheDocument();
  });
});
