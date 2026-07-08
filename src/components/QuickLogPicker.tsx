"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import QuickLog from "@/components/QuickLog";
import type { Contact } from "@/lib/types";

// Dashboard quick-log: search for a contact, then log against them.
export default function QuickLogPicker() {
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

  if (selected) {
    return (
      <div className="space-y-1.5">
        <button
          onClick={() => {
            setSelected(null);
            setQ("");
          }}
          className="text-xs text-muted hover:text-ink"
        >
          ← logging for <span className="text-teal">{selected.name}</span> (change)
        </button>
        <QuickLog contactId={selected.id} />
      </div>
    );
  }

  return (
    <div className="card space-y-2 relative">
      <div className="text-xs uppercase tracking-wide text-muted">Quick log</div>
      <input
        className="w-full"
        placeholder="Search a contact to log against…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {results.length > 0 && (
        <div className="absolute left-4 right-4 top-full -mt-1 z-20 bg-raised border border-edge rounded-md shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
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
