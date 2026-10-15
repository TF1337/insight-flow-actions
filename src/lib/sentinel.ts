import type { Action, Status, Topic } from "@/data/types";

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("nl-NL", opts);
}

export const isClosed = (a: Action) => a.status === "Resultaat gecontroleerd";
export const isFinished = (a: Action) => a.status === "Uitgevoerd" || a.status === "Resultaat gecontroleerd";

export function isOverdue(a: Action, ref: Date = today()) {
  if (!a.due || isFinished(a)) return false;
  return new Date(a.due) < ref;
}

export function daysOverdue(a: Action, ref: Date = today()) {
  if (!a.due || isFinished(a)) return 0;
  const d = Math.round((ref.getTime() - new Date(a.due).getTime()) / 86400000);
  return d > 0 ? d : 0;
}


export const STATUS_TONE: Record<Status, string> = {
  Open: "bg-status-open/15 text-foreground border-status-open/40",
  "In uitvoering": "bg-status-progress/15 text-status-progress border-status-progress/40",
  "Wacht op besluit": "bg-status-wait/20 text-foreground border-status-wait/60",
  Uitgevoerd: "bg-status-done/15 text-foreground border-status-done/50",
  "Resultaat gecontroleerd": "bg-status-checked/15 text-status-checked border-status-checked/50",
};

export const TOPIC_TONE: Record<Topic, string> = {
  Veiligheid: "bg-topic-v",
  Welzijn: "bg-topic-k",
  Gezondheid: "bg-topic-p",
  Milieu: "bg-topic-m",
};
