"use client";

import { useState, useTransition } from "react";
import { pushSegmentToMailerLite, runMailerLiteSync } from "@/lib/actions/mailerlite";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/types";

export default function MailerLiteControls({
  deals,
}: {
  deals: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [kind, setKind] = useState("deal_nda");

  function sync() {
    setStatus("Syncing…");
    startTransition(async () => {
      try {
        const r = await runMailerLiteSync();
        setStatus(`Synced: ${r.subscribers} subscribers, ${r.matched} matched, ${r.groups} groups.`);
      } catch (e) {
        setStatus(`Sync failed: ${(e as Error).message}`);
      }
    });
  }

  function push(formData: FormData) {
    setStatus("Pushing…");
    startTransition(async () => {
      try {
        const r = await pushSegmentToMailerLite(formData);
        setStatus(
          `Pushed ${r.pushed} contacts to “${r.group}”` +
            (r.skippedNoEmail ? ` (${r.skippedNoEmail} skipped — no email).` : ".")
        );
      } catch (e) {
        setStatus(`Push failed: ${(e as Error).message}`);
      }
    });
  }

  const needsDeal = kind === "deal" || kind === "deal_nda";

  return (
    <div className="space-y-3">
      <button className="btn-primary" onClick={sync} disabled={pending}>
        Pull subscribers &amp; match to contacts
      </button>

      <form action={push} className="grid grid-cols-2 gap-3 border-t border-edge pt-3">
        <div className="space-y-1">
          <label>Segment</label>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">
            <option value="deal_nda">Deal — NDA signers</option>
            <option value="deal">Deal — all participants</option>
            <option value="stage">Pipeline stage</option>
            <option value="tag">Tag</option>
            <option value="relationship">Relationship type</option>
          </select>
        </div>
        <div className="space-y-1">
          <label>Value</label>
          {needsDeal ? (
            <select name="value" className="w-full">
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : kind === "stage" ? (
            <select name="value" className="w-full">
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          ) : kind === "relationship" ? (
            <select name="value" className="w-full">
              {["investor", "prospect", "lender", "partner", "vendor", "personal"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input name="value" placeholder="tag name" className="w-full" />
          )}
        </div>
        <div className="space-y-1 col-span-2">
          <label>MailerLite group (created if missing)</label>
          <input name="group_name" placeholder="Avenue NDA signers" required className="w-full" />
        </div>
        <div className="col-span-2">
          <button className="btn-gold" disabled={pending}>
            Push segment to MailerLite
          </button>
        </div>
      </form>

      {status && <div className="text-xs text-muted break-all">{status}</div>}
    </div>
  );
}
