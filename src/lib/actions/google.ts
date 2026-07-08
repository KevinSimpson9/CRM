"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importGoogleContacts, syncCalendar, syncGmail } from "@/lib/google-sync";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
}

export async function runGoogleSyncNow() {
  await requireUser();
  const admin = createAdminClient();
  const gmail = await syncGmail(admin).catch((e) => ({ error: e.message }));
  const calendar = await syncCalendar(admin).catch((e) => ({ error: e.message }));
  revalidatePath("/settings");
  revalidatePath("/");
  return { gmail, calendar };
}

export async function runGoogleContactsImport() {
  await requireUser();
  const admin = createAdminClient();
  const result = await importGoogleContacts(admin);
  revalidatePath("/settings");
  revalidatePath("/contacts");
  return result;
}

export async function disconnectGoogle() {
  await requireUser();
  const admin = createAdminClient();
  await admin.from("google_tokens").delete().eq("id", 1);
  revalidatePath("/settings");
}
