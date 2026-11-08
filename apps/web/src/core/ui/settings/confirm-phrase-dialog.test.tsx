// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_MESSAGES } from '../../../../test/auth-fixture';
import { CONFIRM_COUNTDOWN_SECONDS, ConfirmPhraseDialog } from './confirm-phrase-dialog';

function renderDialog(onConfirm: () => void) {
  render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <ConfirmPhraseDialog
        open
        title="Delete “Project”?"
        description="The action is irreversible"
        phrase="Project"
        confirmLabel="Delete"
        countdownLabel={(seconds) => `Deleting in ${seconds}s`}
        onOpenChange={() => undefined}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>,
  );

  return screen.getByRole('button', { name: /Delete|Deleting in/u });
}

async function advance(seconds: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

describe('phrase confirmation dialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the button locked until the countdown ends', async () => {
    const confirm = renderDialog(() => undefined);

    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent(`Deleting in ${CONFIRM_COUNTDOWN_SECONDS}s`);

    fireEvent.change(screen.getByLabelText('Type “Project” to confirm'), {
      target: { value: 'Project' },
    });

    await advance(CONFIRM_COUNTDOWN_SECONDS);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('stays locked until the phrase matches', async () => {
    renderDialog(() => undefined);

    fireEvent.change(screen.getByLabelText('Type “Project” to confirm'), {
      target: { value: 'something else' },
    });

    await advance(CONFIRM_COUNTDOWN_SECONDS);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('The text does not match');
  });
});
