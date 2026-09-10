import type { ReactNode } from "react";

// The dotted-circle-flanked eyebrow label style from the reference design
// ("◇ WHY CHOOSE US ◇") — used above every major section heading instead
// of a plain uppercase tag.
export default function SectionLabel({
  children,
  tone = "light",
  align = "center",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  align?: "center" | "left";
}) {
  const color = tone === "dark" ? "text-brand-300" : "text-brand-600";
  const line = tone === "dark" ? "bg-white/15" : "bg-gray-200";
  return (
    <div className={`flex items-center gap-3 ${align === "center" ? "justify-center" : "justify-start"}`}>
      {align === "center" && <span className={`h-px w-8 ${line}`} />}
      <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${color}`}>
        <svg viewBox="0 0 8 8" className="h-2 w-2 fill-current">
          <circle cx="4" cy="4" r="4" />
        </svg>
        {children}
      </span>
      <span className={`h-px w-8 ${line}`} />
    </div>
  );
}
