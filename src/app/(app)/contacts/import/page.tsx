"use client";

import { useState } from "react";
import Papa from "papaparse";
import { importContacts, type ImportRow } from "@/lib/actions/contacts";

const FIELDS = [
  { value: "", label: "— skip —" },
  { value: "name", label: "Full name" },
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "email2", label: "Email (2nd)" },
  { value: "phone", label: "Phone" },
  { value: "phone2", label: "Phone (2nd)" },
  { value: "company", label: "Company" },
  { value: "title", label: "Title" },
  { value: "location", label: "Location" },
  { value: "relationship_type", label: "Relationship type" },
  { value: "source", label: "Source" },
  { value: "tags", label: "Tags" },
  { value: "birthday", label: "Birthday" },
  { value: "linkedin_url", label: "LinkedIn URL" },
  { value: "instagram_handle", label: "Instagram" },
  { value: "notes", label: "Notes" },
];

function guessField(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/^(fullname|name|contactname)$/.test(h)) return "name";
  if (/first/.test(h)) return "first_name";
  if (/last|surname/.test(h)) return "last_name";
  if (/email2|secondaryemail/.test(h)) return "email2";
  if (/email/.test(h)) return "email";
  if (/phone2|mobile2/.test(h)) return "phone2";
  if (/phone|mobile|cell/.test(h)) return "phone";
  if (/company|organization|org|employer/.test(h)) return "company";
  if (/title|role|position|job/.test(h)) return "title";
  if (/location|city|address|state/.test(h)) return "location";
  if (/relationship|type/.test(h)) return "relationship_type";
  if (/source|via|from/.test(h)) return "source";
  if (/tags?|labels?|groups?/.test(h)) return "tags";
  if (/birthday|birthdate|dob/.test(h)) return "birthday";
  if (/linkedin/.test(h)) return "linkedin_url";
  if (/instagram|ig/.test(h)) return "instagram_handle";
  if (/notes?|description|comments?/.test(h)) return "notes";
  return "";
}

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(
    null
  );

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields || [];
        setHeaders(hs);
        setRows(res.data);
        setMapping(Object.fromEntries(hs.map((h) => [h, guessField(h)])));
        setResult(null);
      },
    });
  }

  async function runImport() {
    setBusy(true);
    try {
      const mapped: ImportRow[] = rows.map((row) => {
        const out: Record<string, string> = {};
        for (const [header, field] of Object.entries(mapping)) {
          if (!field || !row[header]) continue;
          // Multiple headers can map to tags/notes — concatenate.
          out[field] = out[field] ? `${out[field]}, ${row[header]}` : row[header];
        }
        return out as ImportRow;
      });
      setResult(await importContacts(mapped));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold">Import contacts from CSV</h1>
      <div className="card space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="text-sm"
        />
        <p className="text-xs text-muted">
          Export your Dex / Rolodex list as CSV, drop it here, confirm the column mapping, import.
          Duplicate handling: rows are inserted as-is — clean up dupes in the contacts list after.
        </p>
      </div>

      {headers.length > 0 && !result && (
        <>
          <div className="card space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted">
              Column mapping ({rows.length} rows)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2 text-sm">
                  <span className="w-40 truncate text-muted" title={h}>
                    {h}
                  </span>
                  <select
                    value={mapping[h] || ""}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                    className="flex-1"
                  >
                    {FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="th">
                      {mapping[h] ? FIELDS.find((f) => f.value === mapping[h])?.label : "(skipped)"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} className={`td ${mapping[h] ? "" : "opacity-40"}`}>
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={runImport} disabled={busy} className="btn-primary">
            {busy ? "Importing…" : `Import ${rows.length} contacts`}
          </button>
        </>
      )}

      {result && (
        <div className="card space-y-2">
          <div className="text-teal font-medium">Imported {result.inserted} contacts.</div>
          {result.skipped > 0 && (
            <div className="text-sm text-muted">{result.skipped} rows skipped (no name).</div>
          )}
          {result.errors.map((e, i) => (
            <div key={i} className="text-sm text-red-400">
              {e}
            </div>
          ))}
          <a href="/contacts" className="btn">
            Go to contacts
          </a>
        </div>
      )}
    </div>
  );
}
