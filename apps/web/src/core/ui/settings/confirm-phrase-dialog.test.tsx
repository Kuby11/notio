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
        title="Удалить «Проект»?"
        description="Действие необратимо"
        phrase="Проект"
        confirmLabel="Удалить"
        countdownLabel={(seconds) => `Удаление через ${seconds} с`}
        onOpenChange={() => undefined}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>,
  );

  return screen.getByRole('button', { name: /Удалить|Удаление через/u });
}

async function advance(seconds: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

describe('диалог подтверждения по фразе', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('держит кнопку заблокированной до конца отсчёта', async () => {
    const confirm = renderDialog(() => undefined);

    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent(`Удаление через ${CONFIRM_COUNTDOWN_SECONDS} с`);

    fireEvent.change(screen.getByLabelText('Введите «Проект» для подтверждения'), {
      target: { value: 'Проект' },
    });

    await advance(CONFIRM_COUNTDOWN_SECONDS);

    expect(screen.getByRole('button', { name: 'Удалить' })).toBeEnabled();
  });

  it('не разблокируется, пока фраза не совпала', async () => {
    renderDialog(() => undefined);

    fireEvent.change(screen.getByLabelText('Введите «Проект» для подтверждения'), {
      target: { value: 'другое' },
    });

    await advance(CONFIRM_COUNTDOWN_SECONDS);

    expect(screen.getByRole('button', { name: 'Удалить' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Текст не совпадает');
  });
});
