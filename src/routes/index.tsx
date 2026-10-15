import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronsUp, Minus, TriangleAlert } from "lucide-react";
import { useApp } from "@/data/store";
import { isClosed } from "@/lib/sentinel";
import { KPI_SLA_HEALTHCARE } from "@/data/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KPI-Dashboard Logistieke Operatie" },
      { name: "description", content: "Operationele KPI's en procesindicatoren voor OVM en LDC, met actielijst per KPI." },
      { property: "og:title", content: "KPI-Dashboard Logistieke Operatie" },
      { property: "og:description", content: "Operationele KPI's en procesindicatoren voor OVM en LDC, met actielijst per KPI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type KpiStatus = "gunstig" | "op norm" | "aandacht" | "fictief";

type Kpi = {
  title: string;
  value: string;
  norm: string;
  status: KpiStatus;
  bullets?: string[];
  slaHealthcare?: boolean;
};

type Category = { name: string; tone: string; kpis: Kpi[] };

const OVM: Category[] = [
  {
    name: "Veiligheid",
    tone: "bg-topic-k",
    kpis: [
      { title: "Gedragsregels", value: "5,8", norm: "Norm 5,75", status: "op norm" },
      { title: "Aantal incidenten per maand", value: "0,3", norm: "Norm 0,4", status: "gunstig", bullets: ["Near misses: 30 dagen"] },
    ],
  },
  {
    name: "Kwaliteit",
    tone: "bg-surface-steel",
    kpis: [
      { title: "Retouren", value: "6,4 d", norm: "Norm 7 dagen", status: "gunstig", bullets: ["Retouren binnen SLA · leeftijd retouren"] },
      { title: "Inbound doorlooptijd", value: "19 u", norm: "Norm <24 uur", status: "gunstig", bullets: ["Leveringen na ontvangst IG binnen 24 uur op voorraad"] },
      { title: "HFV doorlooptijd", value: "8,6 u", norm: "Norm nog te bepalen", status: "fictief", bullets: ["Vrijgave tot dock · INCD / PRN-KIL"] },
      { title: "Klantorders", value: "98,7%", norm: "Norm nog te bepalen", status: "fictief", bullets: ["On time: 98,7%", "In full: 99,2%"] },
    ],
  },
  {
    name: "Productiviteit",
    tone: "bg-topic-p",
    kpis: [
      { title: "Retouren Index", value: "97%", norm: "Norm <100%", status: "gunstig" },
      { title: "OVM Index", value: "97%", norm: "Norm <100%", status: "gunstig", bullets: ["Directe uren index: 96%"] },
    ],
  },
  {
    name: "Personeel",
    tone: "bg-topic-m",
    kpis: [
      { title: "Ziekteverzuim", value: "3,8%", norm: "Norm 4,0%", status: "gunstig", bullets: ["Lang verzuim: fictief 2,6%"] },
      { title: "Verhouding vast / flex", value: "94%", norm: "Norm 95%", status: "aandacht", bullets: ["Aandeel flex · fictieve actuele waarde"] },
    ],
  },
];

const LDC: Category[] = [
  {
    name: "Veiligheid",
    tone: "bg-topic-k",
    kpis: [
      { title: "Gedragsregels", value: "5,9", norm: "Norm 5,75", status: "op norm" },
      { title: "Aantal incidenten", value: "0,2", norm: "Norm 0,3", status: "gunstig", bullets: ["Near misses: 30 dagen"] },
    ],
  },
  {
    name: "Kwaliteit",
    tone: "bg-surface-steel",
    kpis: [
      {
        title: "SLA Healthcare",
        value: "98,4%",
        norm: "Norm 98%",
        status: "op norm",
        slaHealthcare: true,
        bullets: ["Outbound vóór 18u: 98,5%", "Inbound na 12u: 98,1%", "Orders in Full: 99,1% · norm 99%"],
      },
      {
        title: "SLA Printlogistiek",
        value: "95,6%",
        norm: "Norm 95%",
        status: "op norm",
        bullets: ["Stock zelfde dag: 95,8%", "Print dag na laatste PF-scan: 95,4%", "Orders in Full: 99,0% · norm 99%"],
      },
    ],
  },
  {
    name: "Productiviteit",
    tone: "bg-topic-p",
    kpis: [
      { title: "WPL Index", value: "97%", norm: "Norm <100%", status: "gunstig", bullets: ["WPI direct: 97%"] },
      { title: "Healthcare Index", value: "97%", norm: "Norm <100%", status: "gunstig" },
    ],
  },
  {
    name: "Personeel",
    tone: "bg-topic-m",
    kpis: [
      { title: "Ziekteverzuim", value: "4,2%", norm: "Norm 4,0%", status: "aandacht" },
      { title: "Verhouding vast / flex", value: "96%", norm: "Norm 95%", status: "op norm", bullets: ["Aandeel flex · fictieve actuele waarde"] },
    ],
  },
];

const STATUS_STYLE: Record<KpiStatus, { bar: string; text: string; icon: typeof Check; label: string }> = {
  gunstig: { bar: "bg-status-checked", text: "text-status-checked", icon: ChevronsUp, label: "gunstig" },
  "op norm": { bar: "bg-status-checked", text: "text-status-checked", icon: Check, label: "op norm" },
  aandacht: { bar: "bg-destructive", text: "text-destructive", icon: TriangleAlert, label: "aandacht" },
  fictief: { bar: "bg-sig-oranje", text: "text-sig-oranje", icon: Minus, label: "fictief" },
};

function KpiCard({ kpi, openCount }: { kpi: Kpi; openCount?: number | undefined }) {
  const s = STATUS_STYLE[kpi.status];
  const Icon = s.icon;
  const body = (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-4 shadow-card transition",
        kpi.slaHealthcare && "cursor-pointer hover:border-accent hover:shadow-elevated",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{kpi.title}</p>
        {kpi.slaHealthcare && <ArrowRight className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
      </div>
      <p className={cn("mt-2 text-3xl font-bold", s.text)}>{kpi.value}</p>
      <p className="text-xs text-muted-foreground">{kpi.norm}</p>
      {kpi.slaHealthcare && openCount !== undefined && (
        <p className="mt-1 text-xs font-semibold text-foreground">{openCount} open acties</p>
      )}
      <div className="mt-3">
        <div className="h-2 w-full rounded-full bg-muted">
          <div className={cn("h-2 rounded-full", s.bar, kpi.status === "fictief" ? "w-2/3" : kpi.status === "aandacht" ? "w-1/3" : "w-full")} />
        </div>
        <p className={cn("mt-1 flex items-center justify-center gap-1 text-xs font-semibold", s.text)}>
          <Icon className="h-3 w-3" aria-hidden /> {s.label}
        </p>
      </div>
      {kpi.bullets && (
        <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
          {kpi.bullets.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      )}
    </div>
  );
  if (kpi.slaHealthcare) {
    return (
      <Link to="/acties" aria-label="Bekijk open acties onder SLA Healthcare">
        {body}
      </Link>
    );
  }
  return body;
}

function SiteColumn({ name, categories, openCount }: { name: string; categories: Category[]; openCount?: number }) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl bg-gradient-industrial px-5 py-3 text-center shadow-card">
        <h2 className="text-xl font-bold text-surface-deep-foreground">{name}</h2>
        <p className="text-xs text-surface-deep-foreground/70">Operationele KPI's en procesindicatoren</p>
      </header>
      {categories.map((cat) => (
        <div key={cat.name}>
          <div className={cn("rounded-md px-4 py-1.5", cat.tone)}>
            <h3 className="text-sm font-bold tracking-wide text-primary-foreground uppercase">{cat.name}</h3>
          </div>
          <div className={cn("mt-2 grid gap-3", cat.kpis.length > 2 ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
            {cat.kpis.map((kpi) => (
              <KpiCard key={kpi.title} kpi={kpi} openCount={kpi.slaHealthcare ? openCount : undefined} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Dashboard() {
  const { actions } = useApp();
  const openCount = actions.filter((a) => a.kpi === KPI_SLA_HEALTHCARE && !isClosed(a)).length;

  return (
    <div className="min-h-screen bg-gradient-floor">
      <header className="bg-surface-deep py-5 shadow-card">
        <h1 className="text-center text-2xl font-bold tracking-wide text-surface-deep-foreground uppercase sm:text-3xl">
          KPI-Dashboard Logistieke Operatie
        </h1>
      </header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-2">
        <SiteColumn name="OVM" categories={OVM} />
        <SiteColumn name="LDC" categories={LDC} openCount={openCount} />
      </main>
      <footer className="pb-8 text-center text-xs text-muted-foreground">
        ▲ gunstig / op norm · ▼ aandacht · → norm nog te bepalen. Alle waarden en trends in dit ontwerp zijn fictief.
      </footer>
    </div>
  );
}
