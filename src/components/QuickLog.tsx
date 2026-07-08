"use client";

import { useRef, useState, useTransition } from "react";
import { logInteraction } from "@/lib/actions/interactions";
import { CHANNELS, type Channel } from "@/lib/types";

const CHANNEL_ICONS: Record<Channel, string> = {
  email: "✉️",
  call: "📞",
  meeting: "🤝",
  text: "💬",
  imessage: "💬",
  whatsapp: "🟢",
  linkedin: "in",
  instagram: "📷",
  in_person: "👥",
  other: "•",
};

// 2-click log: click a channel (selects it), type note, Enter logs it.
export default function QuickLog({
  contactId,
  defaultNote,
}: {
  contactId: string;
  defaultNote?: string;
}) {
  const [channel, setChannel] = useState<Channel>("call");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [note, setNote] = useState(defaultNote || "");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  function submit() {
    const fd = new FormData();
    fd.set("contact_id", contactId);
    fd.set("channel", channel);
    fd.set("direction", direction);
    fd.set("body", note);
    startTransition(async () => {
      await logInteraction(fd);
      setNote("");
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    });
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted">Quick log</div>
        <button
          type="button"
          onClick={() => setDirection(direction === "outbound" ? "inbound" : "outbound")}
          className="chip hover:text-ink"
          title="Toggle direction"
        >
          {direction === "outbound" ? "→ outbound" : "← inbound"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => {
              setChannel(ch);
              noteRef.current?.focus();
            }}
            className={`px-2 py-1 rounded-md text-xs border transition-colors ${
              channel === ch
                ? "border-teal/60 bg-teal-dim/60 text-teal"
                : "border-edge bg-raised text-muted hover:text-ink"
            }`}
          >
            {CHANNEL_ICONS[ch]} {ch.replace("_", " ")}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          ref={noteRef}
          className="flex-1"
          placeholder="What happened? (Enter to log)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !pending && submit()}
        />
        <button type="button" onClick={submit} disabled={pending} className="btn-primary">
          {pending ? "…" : flash ? "Logged ✓" : "Log"}
        </button>
      </div>
    </div>
  );
}
