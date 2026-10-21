import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Camera, Check, ChevronDown, ChevronUp, ImagePlus, LoaderCircle, Plus, RotateCcw, Save, Sparkles, Square, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp, uid } from "@/data/store";
import { KPI_LEVERTIJD_ZORG, isoDay } from "@/data/mock";
import { TOPICS, type Observation, type Priority, type Topic } from "@/data/types";
import { assignees, currentUser, emptyForm, examples, kpiMeasures, type CoachForm } from "@/data/examples";
import { cn } from "@/lib/utils";
import { isFinished } from "@/lib/sentinel";
import { applyPhotoAnalysis, ZONES } from "@/lib/photo-analysis";
import { analysePhoto } from "@/lib/analyse-photo";
import { AnalysisScore } from "@/components/AnalysisScore";

export const Route = createFileRoute("/nieuw")({
  head: () => ({
    meta: [
      { title: "Nieuwe actie — SLA Healthcare" },
      { name: "description", content: "Maak een nieuwe actie aan met foto en 5W1H-analyse onder de KPI SLA Healthcare." },
      { property: "og:title", content: "Nieuwe actie — SLA Healthcare" },
      { property: "og:description", content: "Maak een nieuwe actie aan met foto en 5W1H-analyse onder de KPI SLA Healthcare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: z.object({
    actie: z.string().optional(),
  }),
  component: NewActionPage,
});

const TERMIJNEN = ["7 dagen", "14 dagen", "21 dagen", "28 dagen"] as const;
const AANPAKKEN: Priority[] = ["Actie / Just Do It", "PDCA / 6S", "Change"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{children}</span>;
}

function formFromObservation(o: Observation): CoachForm {
  return {
    tag: o.topic,
    indicators: [],
    description: o.description,
    photo: o.photo ?? "",
    photoLabel: o.title,
    where: o.w5h.waar,
    what: o.w5h.wat,
    why: o.w5h.waarom,
    how: o.w5h.hoe,
    whys: o.whys && o.whys.length > 0 ? o.whys : emptyForm.whys,
  };
}

function NewActionPage() {
  const navigate = useNavigate();
  const { actie: editId } = Route.useSearch();
  const { actions, observations, upsertAction, upsertObservation } = useApp();
  const editing = editId ? actions.find((a) => a.id === editId) : undefined;
  const editingObs = editing?.observationId ? observations.find((o) => o.id === editing.observationId) : undefined;
  const [form, setForm] = useState<CoachForm>(() => (editingObs ? formFromObservation(editingObs) : { ...(examples[0] ?? emptyForm), where: ZONES[0] }));
  const [exampleIndex, setExampleIndex] = useState(editing ? -1 : 0);
  const isExample = exampleIndex >= 0;
  const [photo, setPhoto] = useState<string | null>(null);
  const [termijn, setTermijn] = useState<(typeof TERMIJNEN)[number]>(() => {
    if (!editing?.due) return "14 dagen";
    const days = Math.round((new Date(editing.due).getTime() - Date.now()) / 86400000);
    const nearest = [7, 14, 21, 28].reduce((b, d) => (Math.abs(d - days) < Math.abs(b - days) ? d : b));
    return `${nearest} dagen` as (typeof TERMIJNEN)[number];
  });
  const [aanpak, setAanpak] = useState<Priority>(editing?.priority ?? "Actie / Just Do It");
  const [linkedId, setLinkedId] = useState(editing?.linkedActionId ?? "");
  const [assignee, setAssignee] = useState(() => {
    const match = assignees.find((p) => p.name === editing?.owner);
    return match ? `${match.name} · ${match.role}` : "";
  });
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [analysisScore, setAnalysisScore] = useState<number | null>(null);
  const [piWeights, setPiWeights] = useState<Record<string, number>>({});
  const analysisRequest = useRef<AbortController | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setNow(new Date().toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" }));
    return () => analysisRequest.current?.abort();
  }, []);

  function loadPhoto(selected?: File) {
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 4500000) {
      setError("Kies een JPG-, PNG- of WebP-foto van maximaal 4,5 MB.");
      return;
    }
    analysisRequest.current?.abort();
    const reader = new FileReader();
    reader.onload = () => { setPhoto(String(reader.result)); setError(""); setAiDone(false); setAnalysisScore(null); setPiWeights({}); };
    reader.onerror = () => setError("De foto kon niet worden gelezen.");
    reader.readAsDataURL(selected);
  }

  async function analyse() {
    const image = photo || form.photo;
    if (!image || analysing) return;
    const controller = new AbortController();
    analysisRequest.current = controller;
    setAnalysing(true);
    setAiDone(false);
    setAnalysisScore(null);
    setPiWeights({});
    setError("");
    try {
      const analysis = await analysePhoto(image, form.where, form.tag, controller.signal);
      if (controller.signal.aborted) return;
      const next = applyPhotoAnalysis(form, analysis);
      setForm(next);
      setExpanded(true);
      setAiDone(true);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "De fotoanalyse kon niet worden afgerond.");
    } finally {
      if (analysisRequest.current === controller) { setAnalysing(false); analysisRequest.current = null; }
    }
  }

  const update = (key: keyof Omit<CoachForm, "whys" | "indicators" | "tag">, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  function reset(nextIndex: number) {
    const next = nextIndex >= 0 ? examples[nextIndex] : null;
    analysisRequest.current?.abort();
    setAiDone(false);
    setAnalysisScore(null);
    setPiWeights({});
    setForm({ ...(next ?? emptyForm), where: form.where });
    setExampleIndex(nextIndex);
    setPhoto(null);
    setError("");
    setTermijn("14 dagen");
    setAanpak("Actie / Just Do It");
    setAssignee("");
    setExpanded(true);
  }

  function save() {
    if (!form.what.trim()) {
      setError("Vul bij 'Wat' de feitelijke waarneming in.");
      return;
    }
    const days = Number.parseInt(termijn, 10);
    const obsId = editing?.observationId ?? uid("obs");
    const shown = photo || form.photo || undefined;
    upsertObservation({
      id: obsId,
      title: form.what.trim().slice(0, 80),
      description: form.description || form.what.trim(),
      photo: shown,
      dept: form.where || editingObs?.dept || "Inbound",
      topic: form.tag,
      signal: editingObs?.signal ?? "oranje",
      reporter: editingObs?.reporter ?? currentUser,
      createdAt: editingObs?.createdAt ?? isoDay(0),
      w5h: {
        wie: editingObs?.w5h.wie ?? currentUser,
        wat: form.what.trim(),
        waar: form.where,
        wanneer: editingObs?.w5h.wanneer ?? now,
        waarom: form.why,
        hoe: form.how,
      },
      whys: form.whys,
      waaromOnbekend: !form.why.trim(),
    });
    upsertAction({
      id: editing?.id ?? uid("act"),
      title: editing?.title ?? (form.how.trim() ? form.how.trim().slice(0, 90) : form.what.trim().slice(0, 90)),
      observationId: obsId,
      kpi: KPI_LEVERTIJD_ZORG,
      deviation: form.what.trim().slice(0, 80),
      topic: form.tag,
      dept: form.where || editing?.dept || "Inbound",
      owner: assignee ? (assignee.split(" · ")[0] ?? currentUser) : (editing?.owner ?? currentUser),
      due: isoDay(days),
      priority: aanpak,
      status: editing?.status ?? "Open",
      feedback: editing?.feedback ?? [],
      gedaan: editing?.gedaan ?? "",
      linkedActionId: linkedId || undefined,
      resultaat: editing?.resultaat ?? "",
      createdAt: editing?.createdAt ?? isoDay(0),
    });
    navigate({ to: "/acties" });
  }

  const shownPhoto = photo || form.photo;
  const measures = kpiMeasures[form.tag] ?? [];

  return (
    <div className="min-h-screen bg-gradient-floor">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/acties" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Actielijst SLA Healthcare
            </Link>
            <h1 className="mt-1 text-3xl font-bold">{editing ? "Actie bewerken" : "Nieuwe actie"}</h1>
          </div>
          {!editing && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={analysing} variant="ghost" className="text-xs" onClick={() => reset((exampleIndex + 1) % examples.length)}>
                <RotateCcw /> Voorbeeld
              </Button>
              <Button disabled={analysing} variant="outline" onClick={() => reset(-1)}>
                <Plus /> Nieuwe melding
              </Button>
            </div>
          )}
        </div>

        <section className="overflow-hidden rounded-xl border bg-card shadow-card">
          <fieldset disabled={analysing} className="space-y-6 p-6">
            {/* Foto */}
            <div>
              <FieldLabel>Foto</FieldLabel>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="Foto uploaden"
                onChange={(e) => { loadPhoto(e.target.files?.[0]); e.target.value = ""; }}
              />
              <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" aria-label="Foto opnemen" onChange={(e) => { loadPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="relative h-60 overflow-hidden rounded-lg bg-muted shadow-card">
                {shownPhoto ? (
                  <>
                    <img src={shownPhoto} alt={photo ? "Geüploade observatie" : form.photoLabel} className="h-full w-full object-cover" />
                    <span className="absolute bottom-3 left-3 max-w-[calc(100%-13rem)] truncate text-[11px] text-primary-foreground drop-shadow">
                      {photo ? "Jouw observatie" : form.photoLabel}
                    </span>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImagePlus size={26} />
                    <span className="text-xs">Voeg een foto van je observatie toe</span>
                  </div>
                )}
                <div className="absolute right-2.5 bottom-2.5 flex gap-1.5">
                  <Button variant="secondary" size="icon" aria-label="Foto opnemen" title="Foto opnemen" onClick={() => camera.current?.click()}><Camera /></Button>
                  <Button variant="secondary" size="sm" onClick={() => file.current?.click()}>
                    <ImagePlus /> {shownPhoto ? "Vervangen" : "Foto toevoegen"}
                  </Button>
                  {photo && (
                    <Button size="icon" variant="secondary" aria-label="Foto verwijderen" onClick={() => { setPhoto(null); setAiDone(false); setAnalysisScore(null); setPiWeights({}); }}>
                      <X />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Type observatie */}
            <div>
              <FieldLabel>Type observatie · onderwerp</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {TOPICS.map((t: Topic) => (
                  <Button
                    key={t}
                    variant={form.tag === t ? "default" : "secondary"}
                    size="sm"
                    aria-pressed={form.tag === t}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, tag: t, indicators: [] }));
                      setPiWeights({});
                      setError("");
                    }}
                  >
                    {form.tag === t && <Check className="size-3" />}
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Prestatieindicatoren */}
            <div>
              <FieldLabel>Prestatieindicatoren · {form.tag}</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {measures.map((item) => {
                  const active = form.indicators.includes(item);
                  return (
                    <Button
                      key={item}
                      variant={active ? "default" : "secondary"}
                      size="sm"
                      aria-pressed={active}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          indicators: active ? prev.indicators.filter((v) => v !== item) : [...prev.indicators, item],
                        }))
                      }
                    >
                      {active && <Check className="size-3 shrink-0" />}
                      {item}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Voorbeeldwaarden</p>
            </div>

            {/* 5W1H-analyse */}
            <div className="rounded-lg border bg-muted p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-bold">5W1H-analyse</h2>
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-foreground uppercase">
                  {isExample ? "Voorbeeld" : "Bewerkbaar"}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Wie · ingelogd</FieldLabel>
                  <p className="text-sm">{editingObs?.w5h.wie ?? currentUser}</p>
                </div>
                <div>
                  <FieldLabel>Wanneer · automatisch</FieldLabel>
                  <p className="text-sm">{editingObs?.w5h.wanneer ?? now}</p>
                </div>
              </div>
              <div className="mt-4">
                <FieldLabel>Waar</FieldLabel>
                <input
                  list="standaard-zones"
                  aria-label="Waar"
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  value={form.where}
                  maxLength={200}
                  placeholder="Werkplek of locatie"
                  onChange={(e) => update("where", e.target.value)}
                />
                <datalist id="standaard-zones">{ZONES.map(zone => <option key={zone} value={zone} />)}</datalist>
              </div>
              <div className="mt-4">
                <FieldLabel>Wat · het probleem</FieldLabel>
                <textarea
                  aria-label="Wat · het probleem"
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  rows={2}
                  maxLength={1500}
                  value={form.what}
                  placeholder="Feitelijke waarneming..."
                  onChange={(e) => update("what", e.target.value)}
                />
              </div>
              <div className="mt-4">
                <FieldLabel>Waarom · vermoedelijke grondoorzaak</FieldLabel>
                <textarea
                  aria-label="Waarom · vermoedelijke grondoorzaak"
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  rows={2}
                  maxLength={1500}
                  value={form.why}
                  placeholder="Wat veroorzaakt het probleem?"
                  onChange={(e) => update("why", e.target.value)}
                />
              </div>
              <Button variant="ghost" className="mt-1 h-8 px-0 text-xs text-primary" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                <Target className="size-3.5" />
                {expanded ? "Verberg" : "Bekijk"} de 5× waarom
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </Button>
              {expanded && (
                <div className="mt-3 border-t pt-4">
                  {form.whys.map((w, i) => (
                    <div key={i} className={cn("relative grid grid-cols-[26px_1fr] gap-3 pb-4", i < form.whys.length - 1 && "before:absolute before:top-6 before:bottom-0 before:left-3 before:w-px before:bg-border")}>
                      <span
                        className={cn(
                          "z-10 grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold",
                          i === form.whys.length - 1 ? "border-primary bg-primary text-primary-foreground" : "bg-card text-primary",
                        )}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold" htmlFor={`why-${i}`}>{w.question}</label>
                        <textarea
                          id={`why-${i}`}
                          className="w-full rounded-md border bg-card px-2.5 py-2 text-xs outline-none focus:border-primary"
                          rows={2}
                          maxLength={1500}
                          value={w.answer}
                          placeholder="Omdat..."
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              whys: prev.whys.map((item, j) => (j === i ? { ...item, answer: e.target.value } : item)),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3">
                <FieldLabel>Hoe · maatregel & controle</FieldLabel>
                <textarea
                  aria-label="Hoe · maatregel & controle"
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  rows={3}
                  maxLength={1500}
                  value={form.how}
                  placeholder="Welke actie pakt de oorzaak aan?"
                  onChange={(e) => update("how", e.target.value)}
                />
              </div>
            </div>

            {/* Toewijzen + termijn + aanpak */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Toewijzen aan</FieldLabel>
                <select
                  className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Kies een verantwoordelijke…</option>
                  {assignees.map((p) => (
                    <option key={p.name} value={`${p.name} · ${p.role}`}>
                      {p.name} · {p.role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Termijn</FieldLabel>
                <div className="grid grid-cols-4 gap-1.5">
                  {TERMIJNEN.map((t) => (
                    <Button
                      key={t}
                      variant="secondary"
                      size="sm"
                      className={cn(termijn === t && "border border-sig-oranje bg-accent/15 text-foreground")}
                      aria-pressed={termijn === t}
                      onClick={() => setTermijn(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <FieldLabel>Aanpak</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {AANPAKKEN.map((p) => (
                  <Button key={p} variant={aanpak === p ? "default" : "secondary"} size="sm" aria-pressed={aanpak === p} onClick={() => setAanpak(p)}>
                    {aanpak === p && <Check className="size-3" />}
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Eerder opgelost (koppeling)</FieldLabel>
              <select
                aria-label="Koppelen aan opgeloste actie"
                value={linkedId}
                onChange={(e) => setLinkedId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Geen koppeling</option>
                {actions.filter((a) => isFinished(a) && a.id !== editing?.id).map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>



            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 px-6 pb-5" aria-live="polite">
            {!editing && (
              <>
              {analysing ? (
                <>
                  <span role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> Foto analyseren…</span>
                  <Button variant="outline" size="sm" onClick={() => analysisRequest.current?.abort()}><Square className="size-3" /> Stop</Button>
                </>
              ) : (
                <Button variant="outline" disabled={!shownPhoto} onClick={analyse}><Sparkles /> Analyseer met AI</Button>
              )}
              </>
            )}
              <AnalysisScore value={analysisScore} onChange={setAnalysisScore} disabled={analysing || !shownPhoto} topic={form.tag} indicators={form.indicators} weights={piWeights} onWeightsChange={setPiWeights} />
              {aiDone && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5" /> Analyse ingevuld · niet opgeslagen</span>}
            </div>
          <div className="flex items-center justify-between gap-3 border-t bg-card px-6 py-4">
            <Button variant="ghost" asChild>
              <Link to="/acties">Annuleren</Link>
            </Button>
            <Button disabled={analysing} onClick={save}>
              <Save /> Actie opslaan
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
