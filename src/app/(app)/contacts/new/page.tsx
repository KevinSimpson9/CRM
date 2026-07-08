import ContactForm from "@/components/ContactForm";
import { createContact } from "@/lib/actions/contacts";

export default function NewContactPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New contact</h1>
      <ContactForm action={createContact} />
    </div>
  );
}
