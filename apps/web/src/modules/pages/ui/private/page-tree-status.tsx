interface PageTreeStatusProps {
  children: React.ReactNode;
  tone?: 'muted' | 'error';
}

/**
 * Приватный статус дерева страниц: загрузка, ошибка, пустота.
 * Используется только внутри модуля pages.
 */
export function PageTreeStatus({ children, tone = 'muted' }: PageTreeStatusProps) {
  const className = tone === 'error' ? 'text-red-600' : 'text-neutral-400';

  return <p className={`px-2 py-1 text-xs ${className}`}>{children}</p>;
}
