export type RelationshipType =
  | "investor"
  | "lender"
  | "partner"
  | "vendor"
  | "personal"
  | "prospect";

export type Channel =
  | "email"
  | "call"
  | "meeting"
  | "text"
  | "imessage"
  | "whatsapp"
  | "linkedin"
  | "instagram"
  | "in_person"
  | "other";

export type PipelineStage =
  | "lead"
  | "contacted"
  | "nda"
  | "soft_commit"
  | "docs_sent"
  | "funded"
  | "passed";

export const PIPELINE_STAGES: PipelineStage[] = [
  "lead",
  "contacted",
  "nda",
  "soft_commit",
  "docs_sent",
  "funded",
  "passed",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  nda: "NDA",
  soft_commit: "Soft Commit",
  docs_sent: "Docs Sent",
  funded: "Funded",
  passed: "Passed",
};

export const CHANNELS: Channel[] = [
  "email",
  "call",
  "meeting",
  "text",
  "imessage",
  "whatsapp",
  "linkedin",
  "instagram",
  "in_person",
  "other",
];

export interface ImportantDate {
  label: string;
  date: string; // YYYY-MM-DD
}

export interface Contact {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  company: string | null;
  title: string | null;
  location: string | null;
  relationship_type: RelationshipType;
  source: string | null;
  tags: string[];
  birthday: string | null;
  important_dates: ImportantDate[];
  linkedin_url: string | null;
  instagram_handle: string | null;
  notes: string | null;
  avatar_url: string | null;
  keep_in_touch_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface InvestorProfile {
  contact_id: string;
  accreditation_status: "verified" | "claimed" | "unverified";
  accreditation_verified_date: string | null;
  nda_signed_date: string | null;
  ppm_sent_date: string | null;
  soft_commit_amount: number | null;
  funded_amount: number | null;
  preferred_structures: "note" | "equity" | "either" | null;
  sdira_or_tsp: boolean;
  referral_source: string | null;
  pipeline_stage: PipelineStage;
}

export interface Deal {
  id: string;
  name: string;
  entity: string | null;
  status: "raising" | "closed" | "in_development" | "exited";
  target_raise: number | null;
  raised_to_date: number | null;
  structure_notes: string | null;
}

export interface DealParticipation {
  id: string;
  contact_id: string;
  deal_id: string;
  role: "lender" | "lp" | "guarantor" | "co_developer" | "prospect";
  amount: number | null;
  rate: number | null;
  key_dates: ImportantDate[];
  notes: string | null;
}

export interface Interaction {
  id: string;
  contact_id: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  occurred_at: string;
  subject: string | null;
  body: string | null;
  external_id: string | null;
  source: "manual" | "gmail" | "gcal" | "mcp_adapter" | "import";
}

export interface Reminder {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  type: "keep_in_touch" | "follow_up" | "date_based" | "deal_deadline";
  title: string;
  due_at: string;
  cadence_days: number | null;
  status: "pending" | "done" | "snoozed";
  snoozed_until: string | null;
}
