import { ArrowUp, Clock, RefreshCw, Zap } from "lucide-react";
import type { Priority, Status, Topic } from "@/data/types";
import { STATUS_TONE, TOPIC_TONE } from "@/lib/sentinel";
import { cn } from "@/lib/utils";

export function TopicTag({ topic }: { topic: Topic }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-full", TOPIC_TONE[topic])} aria-hidden />
      {topic}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", STATUS_TONE[status])}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = priority === "Change" ? ArrowUp : priority === "Actie / Just Do It" ? Zap : RefreshCw;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        priority === "Change" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden /> {priority}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive whitespace-nowrap">
      <Clock className="h-3 w-3" aria-hidden /> Termijn verlopen
    </span>
  );
}
