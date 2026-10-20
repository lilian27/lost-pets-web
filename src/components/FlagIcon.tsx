export function FlagIcon({ title }: { title: string }) {
  return (
    <svg
      className="flag-icon"
      data-testid="possible-finding-flag"
      role="img"
      aria-label={title}
      viewBox="0 0 24 24"
      width="18"
      height="18"
    >
      <title>{title}</title>
      <path d="M5 21V4h10l1 2h4v10h-7l-1-2H7v7H5z" fill="currentColor" />
    </svg>
  );
}
