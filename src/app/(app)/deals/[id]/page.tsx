import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContactSelect from "@/components/ContactSelect";
import DeleteButton from "@/components/DeleteButton";
import {
  addParticipation,
  deleteParticipation,
  updateDeal,
  updateParticipation,
} from "@/lib/actions/deals";
import type { Deal, ImportantDate } from "@/lib/types";
import { fmtDate, fmtMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLES = ["prospect", "lender", "lp", "guarantor", "co_developer"];

function ParticipationFields({ part }: { part?: any }) {
  const keyDatesText = ((part?.key_dates as ImportantDate[]) || [])
    .map((d) => `${d.label}: ${d.date}`)
    .join("\n");
  return (
    <>
      <div className="space-y-1">
        <label>Role</label>
        <select name="role" defaultValue={part?.role || "prospect"} className="w-full">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", "-")}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label>Amount ($)</label>
        <input name="amount" defaultValue={part?.amount ?? ""} className="w-full" />
      </div>
      <div className="space-y-1">
        <label>Rate (%)</label>
        <input name="rate" defaultValue={part?.rate ?? ""} className="w-full" />
      </div>
      <div className="space-y-1 col-span-2">
        <label>Key dates (one per line, “Label: YYYY-MM-DD”)</label>
        <textarea
          name="key_dates"
          rows={2}
          placeholder="First interest installment: 2026-09-01"
          defaultValue={keyDatesText}
          className="w-full font-mono text-xs"
        />
      </div>
      <div className="space-y-1 col-span-2">
        <label>Notes</label>
        <input name="notes" defaultValue={part?.notes ?? ""} className="w-full" />
      </div>
    </>
  );
}

export default async function DealPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: deal }, { data: parts }] = await Promise.all([
    supabase.from("deals").select("*").eq("id", params.id).single(),
    supabase
      .from("deal_participations")
      .select("*, contacts(id, name, company)")
      .eq("deal_id", params.id)
      .order("created_at"),
  ]);
  if (!deal) notFound();
  const d = deal as Deal;
  const participants = (parts as any[]) || [];
  const committed = participants.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{d.name}</h1>
        <span className="chip-teal">{d.status.replace("_", " ")}</span>
        {d.entity && <span className="text-sm text-muted">{d.entity}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs text-muted uppercase">Target raise</div>
          <div className="text-lg font-semibold">{fmtMoney(d.target_raise)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-muted uppercase">Raised to date</div>
          <div className="text-lg font-semibold text-teal">{fmtMoney(d.raised_to_date)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-muted uppercase">Participant total</div>
          <div className="text-lg font-semibold text-gold">{fmtMoney(committed)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-muted uppercase">Participants</div>
          <div className="text-lg font-semibold">{participants.length}</div>
        </div>
      </div>

      {d.structure_notes && <div className="card text-sm text-muted">{d.structure_notes}</div>}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Contact</th>
              <th className="th">Role</th>
              <th className="th">Amount</th>
              <th className="th">Rate</th>
              <th className="th">Key dates</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="td">
                  <Link href={`/contacts/${p.contacts?.id}`} className="font-medium hover:text-teal">
                    {p.contacts?.name}
                  </Link>
                  {p.contacts?.company && (
                    <div className="text-xs text-muted">{p.contacts.company}</div>
                  )}
                </td>
                <td className="td">
                  <span className="chip">{p.role.replace("_", "-")}</span>
                </td>
                <td className="td">{fmtMoney(p.amount)}</td>
                <td className="td">{p.rate != null ? `${p.rate}%` : "—"}</td>
                <td className="td text-xs text-muted">
                  {((p.key_dates as ImportantDate[]) || []).map((kd, i) => (
                    <div key={i}>
                      {kd.label}: {fmtDate(kd.date)}
                    </div>
                  ))}
                  {p.notes && <div className="italic">{p.notes}</div>}
                </td>
                <td className="td">
                  <details>
                    <summary className="cursor-pointer text-xs text-muted hover:text-ink">edit</summary>
                    <form
                      action={updateParticipation.bind(null, p.id, d.id)}
                      className="grid grid-cols-2 gap-2 mt-2 w-72"
                    >
                      <ParticipationFields part={p} />
                      <div className="col-span-2 flex items-center gap-3">
                        <button className="btn-primary text-xs">Save</button>
                        <DeleteButton
                          action={deleteParticipation.bind(null, p.id, d.id)}
                          label="Remove"
                          confirmText={`Remove ${p.contacts?.name} from ${d.name}?`}
                        />
                      </div>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
            {participants.length === 0 && (
              <tr>
                <td className="td text-muted text-center" colSpan={6}>
                  No participants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <details className="card" open={participants.length === 0}>
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">
            + Add participant
          </summary>
          <form action={addParticipation.bind(null, d.id)} className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1 col-span-2">
              <label>Contact</label>
              <ContactSelect />
            </div>
            <ParticipationFields />
            <div className="col-span-2">
              <button className="btn-primary">Add to deal</button>
            </div>
          </form>
        </details>

        <details className="card">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">Edit deal</summary>
          <form action={updateDeal.bind(null, d.id)} className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1 col-span-2">
              <label>Name</label>
              <input name="name" defaultValue={d.name} required className="w-full" />
            </div>
            <div className="space-y-1">
              <label>Entity</label>
              <input name="entity" defaultValue={d.entity ?? ""} className="w-full" />
            </div>
            <div className="space-y-1">
              <label>Status</label>
              <select name="status" defaultValue={d.status} className="w-full">
                <option value="raising">raising</option>
                <option value="in_development">in development</option>
                <option value="closed">closed</option>
                <option value="exited">exited</option>
              </select>
            </div>
            <div className="space-y-1">
              <label>Target raise ($)</label>
              <input name="target_raise" defaultValue={d.target_raise ?? ""} className="w-full" />
            </div>
            <div className="space-y-1">
              <label>Raised to date ($)</label>
              <input name="raised_to_date" defaultValue={d.raised_to_date ?? ""} className="w-full" />
            </div>
            <div className="space-y-1 col-span-2">
              <label>Structure notes</label>
              <textarea
                name="structure_notes"
                rows={2}
                defaultValue={d.structure_notes ?? ""}
                className="w-full"
              />
            </div>
            <div className="col-span-2">
              <button className="btn-primary">Save deal</button>
            </div>
          </form>
        </details>
      </div>
    </div>
  );
}
