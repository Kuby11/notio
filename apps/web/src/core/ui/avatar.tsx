'use client';

/** Initials for the avatar: the fallback when there is no image. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * Round avatar: an uploaded image (user.image is a public link to a media
 * file) or initials. Shared by the sidebar, the profile and settings.
 */
export function Avatar({
  name,
  src,
  size,
}: {
  name: string;
  src?: string | null;
  size: 'xs' | 'sm' | 'lg' | 'xl';
}) {
  const dimensions =
    size === 'xl'
      ? 'size-16 text-lg'
      : size === 'lg'
        ? 'size-10 text-sm'
        : size === 'sm'
          ? 'size-7 text-xs'
          : 'size-4 text-[8px]';

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={`shrink-0 rounded-full object-cover ${dimensions}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200 ${dimensions}`}
    >
      {initialsOf(name)}
    </span>
  );
}
