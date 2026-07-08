import type { Interaction } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

const SOURCE_BADGE: Record<string, string> = {
  gmail: "Gmail",
  gcal: "Calendar",
  mcp_adapter: "MCP",
  import: "Import",
};

export default function Timeline({ interactions }: { interactions: Interaction[] }) {
  if (interactions.length === 0) {
    return <div className="text-sm text-muted py-6 text-center">No interactions logged yet.</div>;
  }
  return (
    <ol className="relative border-l border-edge ml-2">
      {interactions.map((i) => (
        <li key={i.id} className="ml-4 pb-5 relative">
          <span
            className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${
              i.direction === "inbound" ? "bg-gold" : "bg-teal"
            }`}
          />
          <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
            <span className="font-medium text-ink capitalize">{i.channel.replace("_", " ")}</span>
            <span>{i.direction === "inbound" ? "← in" : "→ out"}</span>
            <span>{fmtDateTime(i.occurred_at)}</span>
            {SOURCE_BADGE[i.source] && <span className="chip">{SOURCE_BADGE[i.source]}</span>}
          </div>
          {i.subject && <div className="text-sm font-medium mt-0.5">{i.subject}</div>}
          {i.body && (
            <div className="text-sm text-muted mt-0.5 whitespace-pre-wrap break-words">{i.body}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
