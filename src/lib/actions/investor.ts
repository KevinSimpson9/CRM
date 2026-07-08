"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveInvestorProfile(contactId: string, formData: FormData) {
  const supabase = createClient();
  const str = (k: string) => ((formData.get(k) as string) || "").trim();
  const num = (k: string) => {
    const v = str(k).replace(/[$,]/g, "");
    return v ? parseFloat(v) : null;
  };
  const { error } = await supabase.from("investor_profiles").upsert({
    contact_id: contactId,
    accreditation_status: str("accreditation_status") || "unverified",
    accreditation_verified_date: str("accreditation_verified_date") || null,
    nda_signed_date: str("nda_signed_date") || null,
    ppm_sent_date: str("ppm_sent_date") || null,
    soft_commit_amount: num("soft_commit_amount"),
    funded_amount: num("funded_amount"),
    preferred_structures: str("preferred_structures") || null,
    sdira_or_tsp: formData.get("sdira_or_tsp") === "on",
    pipeline_stage: str("pipeline_stage") || "lead",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/pipeline");
}

export async function updatePipelineStage(contactId: string, stage: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("investor_profiles")
    .update({ pipeline_stage: stage })
    .eq("contact_id", contactId);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
  revalidatePath(`/contacts/${contactId}`);
}
