"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keyboard-first: "/" focuses search, "g c" contacts, "g p" pipeline, "g d" deals,
// "g r" reminders, "n" new contact.
export default function GlobalHotkeys() {
  const router = useRouter();

  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout>;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;

      if (e.key === "/") {
        e.preventDefault();
        (document.getElementById("global-search") as HTMLInputElement | null)?.focus();
        return;
      }
      if (e.key === "n") {
        router.push("/contacts/new");
        return;
      }
      if (e.key === "g") {
        pendingG = true;
        clearTimeout(timer);
        timer = setTimeout(() => (pendingG = false), 800);
        return;
      }
      if (pendingG) {
        pendingG = false;
        const map: Record<string, string> = {
          h: "/",
          c: "/contacts",
          p: "/pipeline",
          d: "/deals",
          r: "/reminders",
        };
        if (map[e.key]) router.push(map[e.key]);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
