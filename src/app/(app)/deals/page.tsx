import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDeal } from "@/lib/actions/deals";
import type { Deal } from "@/lib/types";
import { fmtMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  raising: "chip-teal",
  in_development: "chip-gold",
  closed: "chip",
  exited: "chip",
};

export default async function DealsPage() {
  const supabase = createClient();
  const [{ data: deals }, { data: parts }] = await Promise.all([
    supabase.from("deals").select("*").order("created_at"),
    supabase.from("deal_participations").select("deal_id"),
  ]);
  const partCount: Record<string, number> = {};
  for (const p of (parts as any[]) || []) partCount[p.deal_id] = (partCount[p.deal_id] || 0) + 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Deals</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {((deals as Deal[]) || []).map((d) => {
          const pct =
            d.target_raise && d.raised_to_date
              ? Math.min(100, (Number(d.raised_to_date) / Number(d.target_raise)) * 100)
              : null;
          return (
            <Link key={d.id} href={`/deals/${d.id}`} className="card hover:border-teal/40 block space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{d.name}</div>
                <span className={STATUS_CHIP[d.status] || "chip"}>{d.status.replace("_", " ")}</span>
              </div>
              {d.entity && <div className="text-xs text-muted">{d.entity}</div>}
              <div className="text-sm text-muted">
                {fmtMoney(d.raised_to_date)} raised
                {d.target_raise ? ` of ${fmtMoney(d.target_raise)}` : ""}
              </div>
              {pct !== null && (
                <div className="h-1.5 rounded-full bg-raised overflow-hidden">
                  <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
                </div>
              )}
              <div className="text-xs text-muted">{partCount[d.id] || 0} participants</div>
            </Link>
          );
        })}
      </div>

      <details className="card max-w-xl">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink">+ New deal</summary>
        <form action={createDeal} className="grid grid-cols-2 gap-3 mt-3">
          <div className="space-y-1 col-span-2">
            <label>Name *</label>
            <input name="name" required className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Entity</label>
            <input name="entity" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Status</label>
            <select name="status" className="w-full">
              <option value="raising">raising</option>
              <option value="in_development">in development</option>
              <option value="closed">closed</option>
              <option value="exited">exited</option>
            </select>
          </div>
          <div className="space-y-1">
            <label>Target raise ($)</label>
            <input name="target_raise" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Raised to date ($)</label>
            <input name="raised_to_date" className="w-full" />
          </div>
          <div className="space-y-1 col-span-2">
            <label>Structure notes</label>
            <textarea name="structure_notes" rows={2} className="w-full" />
          </div>
          <div className="col-span-2">
            <button className="btn-primary">Create deal</button>
          </div>
        </form>
      </details>
    </div>
  );
}
