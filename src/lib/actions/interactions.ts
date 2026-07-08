"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function logInteraction(formData: FormData) {
  const supabase = createClient();
  const contact_id = formData.get("contact_id") as string;
  const occurredAt = (formData.get("occurred_at") as string) || "";
  const { error } = await supabase.from("interactions").insert({
    contact_id,
    channel: (formData.get("channel") as string) || "other",
    direction: (formData.get("direction") as string) || "outbound",
    subject: ((formData.get("subject") as string) || "").trim() || null,
    body: ((formData.get("body") as string) || "").trim() || null,
    occurred_at: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    source: "manual",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contact_id}`);
  revalidatePath("/");
}

export async function deleteInteraction(id: string, contactId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("interactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contactId}`);
}
