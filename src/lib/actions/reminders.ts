"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/reminders");
  revalidatePath("/");
}

export async function createReminder(formData: FormData) {
  const supabase = createClient();
  const contactId = ((formData.get("contact_id") as string) || "").trim() || null;
  const dueDate = (formData.get("due_date") as string) || "";
  const { error } = await supabase.from("reminders").insert({
    contact_id: contactId,
    type: (formData.get("type") as string) || "follow_up",
    title: ((formData.get("title") as string) || "Follow up").trim(),
    // 17:00 UTC ≈ 9–10 AM PT
    due_at: new Date(`${dueDate}T17:00:00Z`).toISOString(),
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function completeReminder(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("reminders").update({ status: "done" }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

// Snooze keeps status=pending and pushes due_at, so every consumer (dashboard,
// digest, MCP) only ever needs status + due_at. snoozed_until records the push.
export async function snoozeReminder(id: string, days: number) {
  const supabase = createClient();
  const until = new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await supabase
    .from("reminders")
    .update({ due_at: until, snoozed_until: until })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function deleteReminder(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
