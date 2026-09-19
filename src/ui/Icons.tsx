export function HandIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 13V5a1.3 1.3 0 0 1 2.6 0v6-8a1.3 1.3 0 0 1 2.6 0v8-6a1.3 1.3 0 0 1 2.6 0v7-4a1.3 1.3 0 0 1 2.6 0v7.5c0 4-2 6.5-6 6.5-2.4 0-4-1-5.5-3L3.8 14a1.4 1.4 0 0 1 2.2-1.7L8 15" />
    </svg>
  );
}
export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {on ? (
        <>
          <path d="M16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14" />
        </>
      ) : (
        <path d="m17 9 5 6m0-6-5 6" />
      )}
    </svg>
  );
}
export function OrbitIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth=".9"
    >
      <circle cx="14" cy="14" r="3" fill="currentColor" stroke="none" />
      <ellipse cx="14" cy="14" rx="13" ry="6" transform="rotate(-35 14 14)" />
    </svg>
  );
}
