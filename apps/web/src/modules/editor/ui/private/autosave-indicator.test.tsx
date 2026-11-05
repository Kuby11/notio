// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderWithIntl, TEST_MESSAGES } from '../../../../../test/auth-fixture';
import { describe, expect, it } from 'vitest';
import { AutosaveIndicator } from './autosave-indicator';

describe('AutosaveIndicator', () => {
  it('показывает вращающийся индикатор, пока изменение ждёт debounce', () => {
    const { container } = renderWithIntl(<AutosaveIndicator status="pending" />);

    expect(screen.getByRole('status', { name: 'Сохранение документа' })).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('показывает индикатор во время запроса сохранения', () => {
    renderWithIntl(<AutosaveIndicator status="saving" />);

    expect(screen.getByRole('status', { name: 'Сохранение документа' })).toBeInTheDocument();
  });

  it('скрывает индикатор, когда сохранять нечего', () => {
    const { rerender } = renderWithIntl(<AutosaveIndicator status="idle" />);

    expect(screen.queryByRole('status')).toBeNull();

    rerender(
      <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
        <AutosaveIndicator status="saved" />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
