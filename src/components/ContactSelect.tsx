"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/lib/types";

// Searchable contact picker that feeds a hidden contact_id input inside a form.
export default function ContactSelect({ name = "contact_id" }: { name?: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);

  useEffect(() => {
    if (!q.trim() || selected) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("search_contacts", { q: q.trim() });
      setResults(((data as Contact[]) || []).slice(0, 6));
    }, 200);
    return () => clearTimeout(t);
  }, [q, selected]);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id || ""} />
      <input
        className="w-full"
        placeholder="Search contact…"
        value={selected ? selected.name : q}
        onChange={(e) => {
          setSelected(null);
          setQ(e.target.value);
        }}
      />
      {results.length > 0 && !selected && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-raised border border-edge rounded-md shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-teal-dim/40"
            >
              {c.name}
              {c.company && <span className="text-muted"> · {c.company}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
