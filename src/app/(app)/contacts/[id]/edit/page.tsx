import { notFound } from "next/navigation";
import ContactForm from "@/components/ContactForm";
import { updateContact } from "@/lib/actions/contacts";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", params.id).single();
  if (!contact) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit {(contact as Contact).name}</h1>
      <ContactForm contact={contact as Contact} action={updateContact.bind(null, params.id)} />
    </div>
  );
}
