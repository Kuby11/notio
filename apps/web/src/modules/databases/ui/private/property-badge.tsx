import { cn } from 'cn';
import type { PropertyColorPreset } from '@notio/contracts';

const COLOR_CLASSES: Record<PropertyColorPreset, string> = {
  default: 'bg-secondary text-secondary-foreground',
  gray: 'bg-muted text-muted-foreground',
  brown: 'bg-amber-900/15 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  red: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
};

export interface PropertyBadgeProps {
  label: string;
  color?: PropertyColorPreset | string;
  className?: string;
  onClick?: () => void;
}

export function PropertyBadge({
  label,
  color = 'default',
  className,
  onClick,
}: PropertyBadgeProps) {
  const colorClass = COLOR_CLASSES[color as PropertyColorPreset] ?? COLOR_CLASSES.default;

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors select-none',
        colorClass,
        onClick && 'cursor-pointer hover:opacity-80',
        className,
      )}
    >
      {label}
    </span>
  );
}
