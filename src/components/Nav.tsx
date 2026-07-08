"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/deals", label: "Deals" },
  { href: "/reminders", label: "Reminders" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-edge bg-panel/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 h-12 flex items-center gap-5">
        <Link href="/" className="font-semibold whitespace-nowrap">
          AK <span className="text-gold">Capital</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm overflow-x-auto">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap ${
                  active ? "bg-teal-dim/50 text-teal" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action="/contacts" method="GET" className="ml-auto hidden sm:block">
          <input
            type="search"
            name="q"
            placeholder="Search contacts…  ( / )"
            className="w-56"
            onKeyDown={(e) => e.key === "Escape" && (e.target as HTMLInputElement).blur()}
            id="global-search"
          />
        </form>
        <button onClick={signOut} className="text-xs text-muted hover:text-ink whitespace-nowrap">
          Sign out
        </button>
      </div>
    </header>
  );
}
