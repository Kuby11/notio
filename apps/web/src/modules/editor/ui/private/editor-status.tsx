interface EditorStatusProps {
  children: React.ReactNode;
  tone?: 'muted' | 'error';
}

/**
 * Приватный статус редактора: загрузка документа и ошибка загрузки.
 * Используется только внутри модуля editor.
 */
export function EditorStatus({ children, tone = 'muted' }: EditorStatusProps) {
  const className = tone === 'error' ? 'text-red-600' : 'text-neutral-500';

  return <p className={`text-sm ${className}`}>{children}</p>;
}
