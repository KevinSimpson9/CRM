import { createClient } from "@/lib/supabase/server";
import KanbanBoard, { type KanbanCard } from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("investor_profiles")
    .select(
      "contact_id, pipeline_stage, soft_commit_amount, funded_amount, accreditation_status, contacts(name, company)"
    )
    .order("updated_at", { ascending: false });

  const cards: KanbanCard[] = ((data as any[]) || []).map((p) => ({
    contact_id: p.contact_id,
    name: p.contacts?.name ?? "—",
    company: p.contacts?.company ?? null,
    pipeline_stage: p.pipeline_stage,
    soft_commit_amount: p.soft_commit_amount,
    funded_amount: p.funded_amount,
    accreditation_status: p.accreditation_status,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Investor pipeline</h1>
        <span className="text-sm text-muted">
          {cards.length} investors · drag cards between stages
        </span>
      </div>
      <KanbanBoard cards={cards} />
      <p className="text-xs text-muted">
        Add someone to the pipeline from their contact page (investor profile → save).
      </p>
    </div>
  );
}
