import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuickLog from "@/components/QuickLog";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

// Bookmarklet target: /quicklog?name=<guessed name>&note=<prefill>
// Finds matching contacts, then renders the quick-log widget pre-filled.
export default async function QuickLogPage({
  searchParams,
}: {
  searchParams: { name?: string; note?: string; contact_id?: string };
}) {
  const supabase = createClient();
  const note = searchParams.note || "";

  if (searchParams.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", searchParams.contact_id)
      .single();
    if (contact) {
      const c = contact as Contact;
      return (
        <div className="max-w-xl space-y-3">
          <h1 className="text-xl font-semibold">
            Log for <Link href={`/contacts/${c.id}`} className="text-teal">{c.name}</Link>
          </h1>
          <QuickLog contactId={c.id} defaultNote={note} />
        </div>
      );
    }
  }

  const name = (searchParams.name || "").trim();
  const { data: matches } = name
    ? await supabase.rpc("search_contacts", { q: name })
    : { data: [] };
  const list = ((matches as Contact[]) || []).slice(0, 8);

  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-xl font-semibold">Quick log{name ? `: “${name}”` : ""}</h1>
      {list.length === 0 && (
        <div className="card text-sm text-muted">
          No matching contact.{" "}
          <Link href={`/contacts/new`} className="text-teal hover:underline">
            Create one →
          </Link>
        </div>
      )}
      {list.map((c) => (
        <Link
          key={c.id}
          href={`/quicklog?contact_id=${c.id}&note=${encodeURIComponent(note)}`}
          className="card block hover:border-teal/40"
        >
          <span className="font-medium">{c.name}</span>
          {c.company && <span className="text-muted"> · {c.company}</span>}
        </Link>
      ))}
    </div>
  );
}
