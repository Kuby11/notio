interface EditorStatusProps {
  children: React.ReactNode;
  tone?: 'muted' | 'error';
}

/**
 * Private editor status: document loading and load failure.
 * Used only inside the editor module.
 */
export function EditorStatus({ children, tone = 'muted' }: EditorStatusProps) {
  const className = tone === 'error' ? 'text-red-600' : 'text-neutral-500';

  return <p className={`text-sm ${className}`}>{children}</p>;
}
