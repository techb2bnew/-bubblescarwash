// A small icon per service category, matched by keyword in the
// admin-configured category name — falls back to a generic grid icon for
// any category we don't specifically recognise (e.g. a brand-new one added
// in the admin), so the tab bar never breaks as categories are added.
export function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();

  if (lower.includes("wash")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path d="M5 17v-4l2-4h10l2 4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="19" r="1.3" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16" cy="19" r="1.3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (lower.includes("ceramic") || lower.includes("coating") || lower.includes("protect")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path d="M12 3 3 7.5v5c0 5 4 8.5 9 10 5-1.5 9-5 9-10v-5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lower.includes("detail")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (lower.includes("add") || lower.includes("extra")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
