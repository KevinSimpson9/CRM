import { saveInvestorProfile } from "@/lib/actions/investor";
import { PIPELINE_STAGES, STAGE_LABELS, type InvestorProfile } from "@/lib/types";

// Server component: renders the investor profile as an editable form.
export default function InvestorProfileCard({
  contactId,
  profile,
}: {
  contactId: string;
  profile: InvestorProfile | null;
}) {
  const p = profile;
  return (
    <form action={saveInvestorProfile.bind(null, contactId)} className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-gold">Investor profile</div>
        {!p && <span className="text-xs text-muted">not in pipeline yet</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label>Pipeline stage</label>
          <select name="pipeline_stage" defaultValue={p?.pipeline_stage || "lead"} className="w-full">
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label>Accreditation</label>
          <select
            name="accreditation_status"
            defaultValue={p?.accreditation_status || "unverified"}
            className="w-full"
          >
            <option value="unverified">unverified</option>
            <option value="claimed">claimed</option>
            <option value="verified">verified</option>
          </select>
        </div>
        <div className="space-y-1">
          <label>Verified date</label>
          <input
            type="date"
            name="accreditation_verified_date"
            defaultValue={p?.accreditation_verified_date ?? ""}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label>NDA signed</label>
          <input type="date" name="nda_signed_date" defaultValue={p?.nda_signed_date ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label>PPM sent</label>
          <input type="date" name="ppm_sent_date" defaultValue={p?.ppm_sent_date ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label>Preferred structure</label>
          <select
            name="preferred_structures"
            defaultValue={p?.preferred_structures ?? ""}
            className="w-full"
          >
            <option value="">—</option>
            <option value="note">note</option>
            <option value="equity">equity</option>
            <option value="either">either</option>
          </select>
        </div>
        <div className="space-y-1">
          <label>Soft commit ($)</label>
          <input name="soft_commit_amount" defaultValue={p?.soft_commit_amount ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label>Funded ($)</label>
          <input name="funded_amount" defaultValue={p?.funded_amount ?? ""} className="w-full" />
        </div>
      </div>
      <label className="flex items-center gap-2 normal-case text-sm text-muted">
        <input type="checkbox" name="sdira_or_tsp" defaultChecked={p?.sdira_or_tsp} className="w-auto" />
        SDIRA / TSP investor
      </label>
      <button type="submit" className="btn-gold">
        {p ? "Save investor profile" : "Add to pipeline"}
      </button>
    </form>
  );
}
