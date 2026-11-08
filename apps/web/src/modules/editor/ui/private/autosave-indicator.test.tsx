// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderWithIntl, TEST_MESSAGES } from '../../../../../test/auth-fixture';
import { describe, expect, it } from 'vitest';
import { AutosaveIndicator } from './autosave-indicator';

describe('AutosaveIndicator', () => {
  it('shows a spinner while a change waits for the debounce', () => {
    const { container } = renderWithIntl(<AutosaveIndicator status="pending" />);

    expect(screen.getByRole('status', { name: 'Saving document' })).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('shows the indicator while a save request is in flight', () => {
    renderWithIntl(<AutosaveIndicator status="saving" />);

    expect(screen.getByRole('status', { name: 'Saving document' })).toBeInTheDocument();
  });

  it('hides the indicator when there is nothing to save', () => {
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
