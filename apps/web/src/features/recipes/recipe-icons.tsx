export function BookmarkIcon({
  filled,
  className = "h-5 w-5",
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M5.75 3.5h8.5v13l-4.25-2.7-4.25 2.7v-13Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
