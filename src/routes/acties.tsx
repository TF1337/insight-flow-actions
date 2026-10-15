import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/data/store";
import { KPI_LEVERTIJD_ZORG } from "@/data/mock";
import { PRIORITIES, W5H_KEYS, W5H_LABEL, type Action } from "@/data/types";
import { fmtDate, isClosed, isOverdue } from "@/lib/sentinel";
import { OverdueBadge, StatusBadge } from "@/components/sentinel/Badges";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acties")({
  head: () => ({
    meta: [
      { title: "Actielijst — Levertijd Zorg" },
      { name: "description", content: "Openstaande acties onder de KPI Levertijd Zorg, met foto en 5W1H-analyse." },
      { property: "og:title", content: "Actielijst — Levertijd Zorg" },
      { property: "og:description", content: "Openstaande acties onder de KPI Levertijd Zorg, met foto en 5W1H-analyse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: z.object({
    aanpak: z.enum(["Actie / Just Do It", "PDCA / 6S", "Change"]).optional(),
  }),
  component: ActionsPage,
});

function ActionsPage() {
  const { actions, observations } = useApp();
  const { aanpak: aanpakParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const aanpak = aanpakParam ?? "Alle";
  const setAanpak = (p: string) =>
    navigate({ search: (s) => ({ ...s, aanpak: p === "Alle" ? undefined : (p as Action["priority"]) }) });

  const rows = useMemo(
    () =>
      actions
        .filter((a) => a.kpi === KPI_LEVERTIJD_ZORG && !isClosed(a))
        .filter((a) => aanpak === "Alle" || a.priority === aanpak)
        .sort((x, y) => (x.due || "9999").localeCompare(y.due || "9999")),
    [actions, aanpak],
  );

  return (
    <div className="min-h-screen bg-gradient-floor">
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> KPI-dashboard
            </Link>
            <h1 className="mt-1 text-3xl font-bold">Levertijd Zorg · actielijst</h1>
            <p className="text-muted-foreground">{rows.length} open acties onder deze KPI</p>
          </div>
          <Button asChild>
            <Link to="/nieuw">
              <Plus className="h-4 w-4" /> Nieuwe actie
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">Aanpak:</span>
          {["Alle", ...PRIORITIES].map((p) => (
            <button
              key={p}
              onClick={() => setAanpak(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-semibold",
                aanpak === p ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-accent",
              )}
            >
              {p}
            </button>
          ))}
          {aanpakParam && (
            <button
              onClick={() => setAanpak("Alle")}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground"
            >
              {aanpakParam} <X className="h-3.5 w-3.5" aria-label="Filter wissen" />
            </button>
          )}
        </div>

        <div className="grid gap-4">
          {rows.map((a) => {
            const o = observations.find((x) => x.id === a.observationId);
            const open = expanded === a.id;
            return (
              <article key={a.id} className="overflow-hidden rounded-xl border bg-card shadow-card">
                <button
                  onClick={() => setExpanded(open ? null : a.id)}
                  className="flex w-full flex-col text-left transition hover:border-primary sm:flex-row"
                  aria-expanded={open}
                >
                  {o?.photo ? (
                    <img src={o.photo} alt={o.title} className="h-44 w-full object-cover sm:h-auto sm:w-48" />
                  ) : (
                    <div className="grid h-24 w-full place-items-center bg-muted text-xs text-muted-foreground sm:h-auto sm:w-48">Geen foto</div>
                  )}
                  <div className="flex-1 space-y-2 p-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={a.status} />
                      {isOverdue(a) && <OverdueBadge />}
                    </div>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.owner} · {a.due ? fmtDate(a.due) : "geen termijn"} · {a.dept}
                    </p>
                    {o ? (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {W5H_KEYS.map((k) => (
                          <Fragment key={k}>
                            <dt className="font-semibold text-muted-foreground">{W5H_LABEL[k]}</dt>
                            <dd className={open ? "" : "line-clamp-1"}>{o.w5h[k] || "—"}</dd>
                          </Fragment>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-xs text-muted-foreground">Geen gekoppelde observatie (5W1H)</p>
                    )}
                    <p className="rounded-md bg-accent/15 px-2 py-1 text-xs">
                      <span className="font-semibold">Oorzaak (root cause):</span>{" "}
                      {o ? (o.waaromOnbekend || !o.w5h.waarom ? "Nog te bepalen" : o.w5h.waarom) : "Nog te bepalen"}
                    </p>
                  </div>
                </button>
              </article>
            );
          })}
          {rows.length === 0 && <p className="rounded-xl border bg-card p-10 text-center text-muted-foreground shadow-card">Geen openstaande acties voor deze aanpak.</p>}
        </div>
      </main>
    </div>
  );
}
