"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Fades + slides a block into place the first time it scrolls into view.
// Falls back to fully visible immediately if IntersectionObserver isn't
// available, or if the viewer has requested reduced motion.
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const skipAnimation =
    typeof window !== "undefined" &&
    (typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(skipAnimation);

  useEffect(() => {
    const el = ref.current;
    if (!el || skipAnimation) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [skipAnimation]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
