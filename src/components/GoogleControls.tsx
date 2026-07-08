"use client";

import { useState, useTransition } from "react";
import {
  disconnectGoogle,
  runGoogleContactsImport,
  runGoogleSyncNow,
} from "@/lib/actions/google";

export default function GoogleControls({ connected }: { connected: boolean }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>, label: string) {
    setStatus(`${label}…`);
    startTransition(async () => {
      try {
        const res = await fn();
        setStatus(`${label}: ${JSON.stringify(res)}`);
      } catch (e) {
        setStatus(`${label} failed: ${(e as Error).message}`);
      }
    });
  }

  if (!connected) {
    return (
      <a href="/api/google/oauth/start" className="btn-primary">
        Connect Google
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => run(runGoogleSyncNow, "Sync")}
        >
          Sync Gmail + Calendar now
        </button>
        <button
          className="btn"
          disabled={pending}
          onClick={() => run(runGoogleContactsImport, "Contacts import")}
        >
          Import Google Contacts
        </button>
        <button
          className="text-xs text-muted hover:text-red-400"
          disabled={pending}
          onClick={() => {
            if (confirm("Disconnect Google? Synced history stays; future syncs stop.")) {
              run(disconnectGoogle, "Disconnect");
            }
          }}
        >
          Disconnect
        </button>
      </div>
      {status && <div className="text-xs text-muted break-all">{status}</div>}
    </div>
  );
}
