"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ImportantDate } from "@/lib/types";

function parseKeyDates(s: string): ImportantDate[] {
  return s
    .split("\n")
    .map((line) => {
      const m = line.match(/^(.*?):\s*(\d{4}-\d{2}-\d{2})\s*$/);
      return m ? { label: m[1].trim(), date: m[2] } : null;
    })
    .filter((x): x is ImportantDate => x !== null);
}

const str = (fd: FormData, k: string) => ((fd.get(k) as string) || "").trim();
const num = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(/[$,%]/g, "");
  return v ? parseFloat(v) : null;
};

export async function createDeal(formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("deals").insert({
    name: str(formData, "name"),
    entity: str(formData, "entity") || null,
    status: str(formData, "status") || "raising",
    target_raise: num(formData, "target_raise"),
    raised_to_date: num(formData, "raised_to_date"),
    structure_notes: str(formData, "structure_notes") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/deals");
}

export async function updateDeal(id: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("deals")
    .update({
      name: str(formData, "name"),
      entity: str(formData, "entity") || null,
      status: str(formData, "status") || "raising",
      target_raise: num(formData, "target_raise"),
      raised_to_date: num(formData, "raised_to_date"),
      structure_notes: str(formData, "structure_notes") || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
}

export async function addParticipation(dealId: string, formData: FormData) {
  const supabase = createClient();
  const contactId = str(formData, "contact_id");
  if (!contactId) throw new Error("Pick a contact first.");
  const { error } = await supabase.from("deal_participations").insert({
    deal_id: dealId,
    contact_id: contactId,
    role: str(formData, "role") || "prospect",
    amount: num(formData, "amount"),
    rate: num(formData, "rate"),
    key_dates: parseKeyDates(str(formData, "key_dates")),
    notes: str(formData, "notes") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/contacts/${contactId}`);
}

export async function updateParticipation(id: string, dealId: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("deal_participations")
    .update({
      role: str(formData, "role") || "prospect",
      amount: num(formData, "amount"),
      rate: num(formData, "rate"),
      key_dates: parseKeyDates(str(formData, "key_dates")),
      notes: str(formData, "notes") || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/deals/${dealId}`);
}

export async function deleteParticipation(id: string, dealId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("deal_participations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/deals/${dealId}`);
}
