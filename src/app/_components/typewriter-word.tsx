"use client";

import { useEffect, useState } from "react";

const TYPE_SPEED = 55;

export default function TypewriterWord({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, TYPE_SPEED);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span className={className}>
      {typed}
      {typed.length < text.length && <span className="animate-pulse text-brand-400">|</span>}
    </span>
  );
}
