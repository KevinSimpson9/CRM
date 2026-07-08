"use client";

import { useOptimistic, useTransition, useState } from "react";
import Link from "next/link";
import { updatePipelineStage } from "@/lib/actions/investor";
import { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from "@/lib/types";
import { fmtMoney } from "@/lib/utils";

export interface KanbanCard {
  contact_id: string;
  name: string;
  company: string | null;
  pipeline_stage: PipelineStage;
  soft_commit_amount: number | null;
  funded_amount: number | null;
  accreditation_status: string;
}

export default function KanbanBoard({ cards }: { cards: KanbanCard[] }) {
  const [, startTransition] = useTransition();
  const [optimisticCards, moveCard] = useOptimistic(
    cards,
    (state, { id, stage }: { id: string; stage: PipelineStage }) =>
      state.map((c) => (c.contact_id === id ? { ...c, pipeline_stage: stage } : c))
  );
  const [dragOver, setDragOver] = useState<PipelineStage | null>(null);

  function onDrop(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/contact-id");
    if (!id) return;
    startTransition(async () => {
      moveCard({ id, stage });
      await updatePipelineStage(id, stage);
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 items-start">
      {PIPELINE_STAGES.map((stage) => {
        const col = optimisticCards.filter((c) => c.pipeline_stage === stage);
        const total = col.reduce(
          (s, c) => s + (Number(c.funded_amount) || Number(c.soft_commit_amount) || 0),
          0
        );
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(stage);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, stage)}
            className={`w-60 shrink-0 rounded-lg border p-2 transition-colors ${
              dragOver === stage ? "border-teal/60 bg-teal-dim/20" : "border-edge bg-panel"
            }`}
          >
            <div className="flex justify-between items-baseline px-1 pb-2">
              <span className="text-xs uppercase tracking-wide text-muted">
                {STAGE_LABELS[stage]} <span className="text-ink">{col.length}</span>
              </span>
              {total > 0 && <span className="text-xs text-gold">{fmtMoney(total)}</span>}
            </div>
            <div className="space-y-1.5 min-h-10">
              {col.map((c) => (
                <div
                  key={c.contact_id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/contact-id", c.contact_id)}
                  className="rounded-md border border-edge bg-raised p-2 cursor-grab active:cursor-grabbing hover:border-teal/40"
                >
                  <Link
                    href={`/contacts/${c.contact_id}`}
                    className="text-sm font-medium hover:text-teal block"
                  >
                    {c.name}
                  </Link>
                  {c.company && <div className="text-xs text-muted">{c.company}</div>}
                  <div className="flex gap-1.5 mt-1 text-xs">
                    {c.accreditation_status === "verified" && (
                      <span className="text-teal">✓ accredited</span>
                    )}
                    {(c.funded_amount || c.soft_commit_amount) && (
                      <span className="text-gold">
                        {fmtMoney(Number(c.funded_amount) || Number(c.soft_commit_amount))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
