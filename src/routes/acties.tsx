import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, ChevronUp, Clock, Gauge, Users, CheckCircle, Plus, RefreshCw, Shield, X, Zap } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApp } from "@/data/store";
import { KPI_LEVERTIJD_ZORG } from "@/data/mock";
import { W5H_KEYS, W5H_LABEL, type Action, type Priority, type Topic } from "@/data/types";

const TOPIC_KPI: Record<Topic, { icon: typeof Shield; kpi: string; pi: string }> = {
  Veiligheid: { icon: Shield, kpi: "Aantal incidenten", pi: "Near misses: 30 dagen" },
  Kwaliteit: { icon: CheckCircle, kpi: "SLA Healthcare", pi: "Orders in Full" },
  Productiviteit: { icon: Gauge, kpi: "WPL Index", pi: "WPI direct" },
  Personeel: { icon: Users, kpi: "Ziekteverzuim", pi: "Lang verzuim" },
};
import { actionSignal, daysOverdue, fmtDate, isFinished, isOverdue, SIGNAL_LABEL, SIGNAL_TONE } from "@/lib/sentinel";
import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/sentinel/Badges";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acties")({
  head: () => ({
    meta: [
      { title: "Actielijst — SLA Healthcare" },
      { name: "description", content: "Openstaande acties onder de KPI SLA Healthcare, met foto en 5W1H-analyse." },
      { property: "og:title", content: "Actielijst — SLA Healthcare" },
      { property: "og:description", content: "Openstaande acties onder de KPI SLA Healthcare, met foto en 5W1H-analyse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: z.object({
    aanpak: z.enum(["Actie / Just Do It", "PDCA / 6S", "Change"]).optional(),
    tab: z.enum(["open", "opgelost"]).optional(),
  }),
  component: ActionsPage,
});

function ActionsPage() {
  const { actions, observations } = useApp();
  const { aanpak: aanpakParam, tab: tabParam } = Route.useSearch();
  const tab = tabParam ?? "open";
  const navigate = Route.useNavigate();
  const [oorzaakOpen, setOorzaakOpen] = useState<string | null>(null);
  const [verlopenOpen, setVerlopenOpen] = useState(false);
  const aanpak = aanpakParam ?? "Alle";
  const setAanpak = (p: string) =>
    navigate({ to: "/acties", search: { ...(p === "Alle" ? {} : { aanpak: p as Action["priority"] }), ...(tab === "opgelost" ? { tab } : {}) } });
  const setTab = (t: "open" | "opgelost") => navigate({ to: "/acties", search: t === "open" ? {} : { tab: t } });

  const kpiActions = useMemo(() => actions.filter((a) => a.kpi === KPI_LEVERTIJD_ZORG), [actions]);
  const openAll = kpiActions.filter((a) => !isFinished(a));
  const solved = kpiActions.filter((a) => isFinished(a));
  const open = tab === "open" ? openAll : solved;
  const openOf = (p: Priority) => open.filter((a) => a.priority === p);
  const verlopen = openAll.filter((a) => isOverdue(a));

  const rows = useMemo(
    () =>
      open
        .filter((a) => aanpak === "Alle" || a.priority === aanpak)
        .sort((x, y) => (tab === "open" ? 1 : -1) * (x.due || "9999").localeCompare(y.due || "9999")),
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
            <h1 className="mt-1 text-3xl font-bold">SLA Healthcare · actielijst</h1>
            <p className="text-muted-foreground">{rows.length} {tab === "open" ? "open" : "opgeloste"} acties onder deze KPI</p>
          </div>
          <Button asChild>
            <Link to="/nieuw">
              <Plus className="h-4 w-4" /> Nieuwe actie
            </Link>
          </Button>
        </div>

        <div role="tablist" className="inline-flex rounded-lg border bg-card p-1 shadow-card">
          {([["open", `Open (${openAll.length})`], ["opgelost", `Opgelost (${solved.length})`]] as const).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded-md px-4 py-1.5 text-sm font-semibold", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "open" && verlopen.length > 0 && (
          <section className="rounded-xl border border-destructive/40 bg-card p-3 shadow-card">
            <Button
              variant="ghost"
              className="h-8 w-full justify-start px-1.5 text-sm font-bold hover:bg-transparent"
              aria-expanded={verlopenOpen}
              onClick={() => setVerlopenOpen((v) => !v)}
            >
              <Clock className="h-4 w-4 text-destructive" /> Verlopen ({verlopen.length})
              {verlopenOpen ? <ChevronUp className="ml-auto size-3.5" /> : <ChevronDown className="ml-auto size-3.5" />}
            </Button>
            {verlopenOpen && (
            <ul className="mt-1 grid gap-1.5 md:grid-cols-2">
              {verlopen.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/nieuw"
                    search={{ actie: a.id }}
                    className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
                    <PriorityBadge priority={a.priority} />
                    <span className="shrink-0 text-xs font-semibold text-destructive">
                      {daysOverdue(a)} {daysOverdue(a) > 1 ? "dgn" : "dag"} verlopen
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            )}
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
            const whys = o?.whys ?? [];
            const oorzaakUitgeklapt = oorzaakOpen === a.id;
            const sig = actionSignal(a);
            const linked = a.linkedActionId ? actions.find((x) => x.id === a.linkedActionId) : undefined;
            const linkedBy = actions.filter((x) => x.linkedActionId === a.id);
            return (
              <article key={a.id} className="relative overflow-hidden rounded-xl border bg-card shadow-card">
                <span className={cn("absolute inset-y-0 left-0 z-10 w-1.5", SIGNAL_TONE[sig])} aria-hidden />
                <Link
                  to="/nieuw"
                  search={{ actie: a.id }}
                  className="flex w-full flex-col text-left transition hover:bg-muted/40 sm:flex-row"
                  aria-label={`Actie openen in formulier: ${a.title}`}
                >
                  {o?.photo ? (
                    <img src={o.photo} alt={o.title} className="h-44 w-full object-cover sm:h-auto sm:w-48" />
                  ) : (
                    <div className="grid h-24 w-full place-items-center bg-muted text-xs text-muted-foreground sm:h-auto sm:w-48">Geen foto</div>
                  )}
                  <div className="flex-1 space-y-2 p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <span className={cn("h-2.5 w-2.5 rounded-full", SIGNAL_TONE[sig])} aria-hidden />
                        {SIGNAL_LABEL[sig]}
                      </span>
                      <StatusBadge status={a.status} />
                      <PriorityBadge priority={a.priority} />
                      {isOverdue(a) && <OverdueBadge />}
                    </div>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.owner} · {a.due ? fmtDate(a.due) : "geen termijn"} · {a.dept}
                    </p>
                    {(() => {
                      const t = TOPIC_KPI[a.topic];
                      return (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <t.icon className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                          <span className="font-medium">KPI {t.kpi}</span>
                          <span aria-hidden>·</span>
                          <span>PI {t.pi}</span>
                        </p>
                      );
                    })()}
                    {isFinished(a) && (a.gedaan || a.resultaat) && (
                      <div className="rounded-md bg-sig-groen/10 p-2 text-xs">
                        {a.gedaan && <p><span className="font-semibold">Hoe opgelost:</span> {a.gedaan}</p>}
                        {a.resultaat && <p><span className="font-semibold">Resultaat:</span> {a.resultaat}</p>}
                      </div>
                    )}
                    {o ? (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {W5H_KEYS.map((k) => (
                          <Fragment key={k}>
                            <dt className="font-semibold text-muted-foreground">{W5H_LABEL[k]}</dt>
                            <dd className="line-clamp-1">{o.w5h[k] || "—"}</dd>
                          </Fragment>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-xs text-muted-foreground">Geen gekoppelde observatie (5W1H)</p>
                    )}
                  </div>
                </Link>
                {linked && (
                  <div className="border-t bg-sig-groen/10 px-4 py-2 text-xs">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-sig-groen" aria-hidden /> Eerder opgelost: {linked.title}
                    </p>
                    {linked.gedaan && <p className="mt-0.5 text-muted-foreground">{linked.gedaan}</p>}
                    {linked.resultaat && <p className="text-muted-foreground">Resultaat: {linked.resultaat}</p>}
                  </div>
                )}
                {linkedBy.length > 0 && (
                  <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                    Komt opnieuw voor bij: <span className="font-medium text-foreground">{linkedBy.map((x) => x.title).join(", ")}</span>
                  </p>
                )}
                <div className="border-t px-3 py-1.5">
                  <button
                    onClick={() => setOorzaakOpen(oorzaakUitgeklapt ? null : a.id)}
                    aria-expanded={oorzaakUitgeklapt}
                    className="flex w-full items-center gap-2 rounded-md bg-accent/15 px-2 py-1 text-left text-xs hover:bg-accent/25"
                  >
                    <span className="shrink-0 font-semibold">Oorzaak (root cause):</span>
                    <span className="min-w-0 flex-1 truncate">
                      {o ? (o.waaromOnbekend || !o.w5h.waarom ? "Nog te bepalen" : o.w5h.waarom) : "Nog te bepalen"}
                    </span>
                    {oorzaakUitgeklapt ? <ChevronUp className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
                  </button>
                  {oorzaakUitgeklapt && (
                    <div className="px-2 pt-3 pb-2">
                      <p className="mb-3 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">5× waarom</p>
                      {whys.length > 0 ? (
                        <ol>
                          {whys.map((w, i) => (
                            <li
                              key={i}
                              className={cn(
                                "relative grid grid-cols-[26px_1fr] gap-3 pb-3",
                                i < whys.length - 1 && "before:absolute before:top-6 before:bottom-0 before:left-3 before:w-px before:bg-border",
                              )}
                            >
                              <span
                                className={cn(
                                  "z-10 grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold",
                                  i === whys.length - 1 ? "border-primary bg-primary text-primary-foreground" : "bg-card text-primary",
                                )}
                              >
                                {i + 1}
                              </span>
                              <div>
                                <p className="text-xs font-semibold">{w.question}</p>
                                <p className="text-xs text-muted-foreground">{w.answer || "—"}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          De 5× waarom is nog niet ingevuld. Open de actie in het formulier om de grondoorzaak te bepalen.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {rows.length === 0 && <p className="rounded-xl border bg-card p-10 text-center text-muted-foreground shadow-card">{tab === "open" ? "Geen openstaande acties voor deze aanpak." : "Geen opgeloste acties voor deze aanpak."}</p>}
        </div>
      </main>
    </div>
  );
}
