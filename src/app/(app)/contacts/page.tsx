import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPES = ["all", "investor", "prospect", "lender", "partner", "vendor", "personal"];

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim();
  const type = searchParams.type && searchParams.type !== "all" ? searchParams.type : null;

  let contacts: Contact[] = [];
  if (q) {
    const { data } = await supabase.rpc("search_contacts", { q });
    contacts = (data as Contact[]) || [];
    if (type) contacts = contacts.filter((c) => c.relationship_type === type);
  } else {
    let query = supabase.from("contacts").select("*").order("updated_at", { ascending: false }).limit(200);
    if (type) query = query.eq("relationship_type", type);
    const { data } = await query;
    contacts = (data as Contact[]) || [];
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Contacts</h1>
        {q && <span className="text-sm text-muted">matching “{q}”</span>}
        <div className="ml-auto flex gap-2">
          <Link href="/contacts/import" className="btn">
            Import CSV
          </Link>
          <Link href="/contacts/new" className="btn-primary">
            New contact
          </Link>
        </div>
      </div>

      <div className="flex gap-1 text-sm">
        {TYPES.map((t) => (
          <Link
            key={t}
            href={`/contacts?${new URLSearchParams({ ...(q ? { q } : {}), type: t })}`}
            className={`px-2.5 py-1 rounded-md capitalize ${
              (searchParams.type || "all") === t
                ? "bg-teal-dim/50 text-teal"
                : "text-muted hover:text-ink"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Company</th>
              <th className="th">Type</th>
              <th className="th">Email</th>
              <th className="th">Tags</th>
              <th className="th">Updated</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-raised/60">
                <td className="td">
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:text-teal">
                    {c.name}
                  </Link>
                </td>
                <td className="td text-muted">{c.company || "—"}</td>
                <td className="td">
                  <span className={c.relationship_type === "investor" ? "chip-gold" : "chip"}>
                    {c.relationship_type}
                  </span>
                </td>
                <td className="td text-muted">{c.emails[0] || "—"}</td>
                <td className="td">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.slice(0, 3).map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="td text-muted">{fmtDate(c.updated_at)}</td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td className="td text-muted text-center" colSpan={6}>
                  {q ? "No matches." : "No contacts yet — import your CSV or add one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
