export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="td-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="7" fill="url(#td-g)" />
      <path d="M9 11 L23 11 L23 13.5 L17.5 13.5 L17.5 23 L14.5 23 L14.5 13.5 L9 13.5 Z" fill="#0a0a0c" />
      <circle cx="22" cy="22" r="2" fill="#0a0a0c" />
    </svg>
  );
}
