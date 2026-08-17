"use client";

export function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 uppercase tracking-wide hover:text-gray-700"
      >
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${
            active && currentDir === "desc" ? "rotate-180" : ""
          } ${active ? "opacity-100" : "opacity-30"}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </th>
  );
}
