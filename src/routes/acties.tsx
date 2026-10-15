import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, ChevronRight, Clock, Plus, RefreshCw, X, Zap } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/data/store";
import { KPI_LEVERTIJD_ZORG } from "@/data/mock";
import { PRIORITIES, W5H_KEYS, W5H_LABEL, type Action, type Priority } from "@/data/types";
import { fmtDate, isClosed, isOverdue } from "@/lib/sentinel";
import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/sentinel/Badges";
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

  const open = useMemo(() => actions.filter((a) => a.kpi === KPI_LEVERTIJD_ZORG && !isClosed(a)), [actions]);
  const openOf = (p: Priority) => open.filter((a) => a.priority === p);
  const longOpen = open.filter((a) => a.status !== "Uitgevoerd" && (Date.now() - new Date(a.createdAt).getTime()) / 86400000 >= 21);

  const rows = useMemo(
    () =>
      open
        .filter((a) => aanpak === "Alle" || a.priority === aanpak)
        .sort((x, y) => (x.due || "9999").localeCompare(y.due || "9999")),
    [open, aanpak],
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

        {longOpen.length > 0 && (
          <section className="rounded-xl border border-destructive/40 bg-card p-3 shadow-card">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Clock className="h-4 w-4 text-destructive" /> Al meerdere weken open ({longOpen.length})
            </p>
            <ul className="grid gap-1.5 md:grid-cols-2">
              {longOpen.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      setAanpak("Alle");
                      setExpanded(a.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
                    <PriorityBadge priority={a.priority} />
                    <span className="shrink-0 text-xs font-semibold text-destructive">
                      {Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 604800000)} wkn
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              { aanpak: "Actie / Just Do It", icon: Zap, hint: "Direct oplosbaar, klein en snel" },
              { aanpak: "PDCA / 6S", icon: RefreshCw, hint: "Plan-Do-Check-Act en werkplekorganisatie" },
              { aanpak: "Change", icon: ArrowUpRight, hint: "A3 / Lean Six Sigma — structurele verandering" },
            ] as const
          ).map(({ aanpak: p, icon: Icon, hint }) => {
            const items = openOf(p);
            const overdue = items.filter((a) => isOverdue(a)).length;
            const decision = items.filter((a) => a.status === "Wacht op besluit").length;
            const active = aanpak === p;
            return (
              <button
                key={p}
                onClick={() => setAanpak(active ? "Alle" : p)}
                aria-pressed={active}
                className={cn(
                  "group block rounded-xl border bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:shadow-elevated md:p-5",
                  active && "border-primary",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-muted-foreground">{p}</p>
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                </div>
                <p className="mt-2 text-4xl font-bold md:text-5xl">{items.length}</p>
                <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {hint}
                    {(overdue > 0 || decision > 0) && (
                      <span className="mt-1 block font-semibold text-foreground">
                        {overdue > 0 && <span className="text-destructive">{overdue} verlopen</span>}
                        {overdue > 0 && decision > 0 && " · "}
                        {decision > 0 && `${decision} wacht op besluit`}
                      </span>
                    )}
                  </span>
                  {active ? (
                    <X className="h-4 w-4" aria-label="Filter wissen" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                  )}
                </p>
              </button>
            );
          })}
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
