import type { Topic } from "./types";
import memorial from "@/assets/jefferson-memorial.jpg";
import nooduitgangFoto from "@/assets/nooduitgang.jpg";
import olielekkageFoto from "@/assets/olielekkage.jpg";
import tillenFoto from "@/assets/zwaar-tillen.jpg";

export const kpiMeasures: Record<Topic, string[]> = {
  Veiligheid: ["Gedragsregels", "Incidenten", "Incidenten met letsel", "Incidenten zonder letsel", "Near misses: 30 dagen"],
  Kwaliteit: ["Retouren binnen SLA", "Leeftijd retouren", "Inbound doorlooptijd", "HBV doorlooptijd", "Outbound vóór 18u", "Inbound na 12u", "Orders in Full", "Stock zelfde dag", "Print dag na laatste PF-scan"],
  Productiviteit: ["Retouren Index", "OFM Index", "WPL Index", "Healthcare Index", "WPI direct"],
  Personeel: ["Ziekteverzuim", "Lang verzuim", "Verhouding vast / flex", "Aandeel flex"],
};

// Sub-maten die onder een bovenliggende PI vallen (bijv. Incidenten).
export const piChildren: Record<string, string[]> = {
  Incidenten: ["Incidenten met letsel", "Incidenten zonder letsel", "Near misses: 30 dagen"],
};

const allChildren = Object.values(piChildren).flat();

export function relevantMeasures(topic: Topic, selected: string[]): string[] {
  const measures = kpiMeasures[topic];
  const relevant = measures.filter(indicator => selected.includes(indicator));
  if (!relevant.length) return measures;
  // Voeg de bovenliggende PI toe als een sub-maat geselecteerd is, en andersom.
  const expanded = relevant.flatMap(indicator => {
    const parent = Object.keys(piChildren).find(name => piChildren[name]?.includes(indicator));
    const children = piChildren[indicator] ?? [];
    return [parent, indicator, ...children].filter((item): item is string => Boolean(item));
  });
  return measures.filter(indicator => expanded.includes(indicator));
}

export function isSubMeasure(indicator: string): boolean {
  return allChildren.includes(indicator);
}

export type Why = { question: string; answer: string };

export type CoachForm = {
  tag: Topic;
  indicators: string[];
  description: string;
  photo: string;
  photoLabel: string;
  where: string;
  what: string;
  why: string;
  how: string;
  whys: Why[];
};

const example: Omit<CoachForm, "tag" | "indicators"> = {
  description:
    "Het marmer van het Jefferson Memorial slijt sneller dan verwacht. Het monument wordt vaak gereinigd vanwege grote hoeveelheden vogelpoep.",
  photo: memorial,
  photoLabel: "Jefferson Memorial · lesvoorbeeld",
  where: "Jefferson Memorial, Washington D.C.",
  what: "Het marmer raakt beschadigd door frequent schoonmaken.",
  why: "De verlichting trekt bij zonsondergang muggen aan. Dit leidt tot spinnen, vogels en meer vogelpoep.",
  how: "Schakel de verlichting pas één uur na zonsondergang in. Meet daarna de hoeveelheid vogelpoep en de schoonmaakfrequentie.",
  whys: [
    { question: "Waarom slijt het marmer zo snel?", answer: "Door veelvuldig reinigen met krachtige waterstralen en zeep." },
    { question: "Waarom wordt het zo vaak gereinigd?", answer: "Er ligt veel vogelpoep op het monument." },
    { question: "Waarom zijn er zoveel vogels?", answer: "De vogels komen af op de vele spinnen als voedsel." },
    { question: "Waarom zijn er zoveel spinnen?", answer: "De spinnen eten de muggen rond het monument." },
    { question: "Waarom zijn er zoveel muggen?", answer: "De felle verlichting bij zonsondergang trekt muggen aan." },
  ],
};

const nooduitgang: Omit<CoachForm, "tag" | "indicators"> = {
  description: "Gestapelde dozen staan voor de nooduitgang bij inbound west. Bij een calamiteit is de vluchtroute geblokkeerd.",
  photo: nooduitgangFoto,
  photoLabel: "Nooduitgang inbound west · lesvoorbeeld",
  where: "Inbound west",
  what: "Nooduitgang geblokkeerd door gestapelde dozen.",
  why: "Er is geen vaste bufferplek voor overloop na het lossen, dus belanden dozen voor de nooduitgang.",
  how: "Nooduitgang direct vrijmaken en een bufferplek markeren met een geel belijnd vak. Controleer dagelijks tijdens de ronde.",
  whys: [
    { question: "Waarom staan er dozen voor de nooduitgang?", answer: "Na het lossen wordt overloop tijdelijk daar neergezet." },
    { question: "Waarom wordt overloop daar neergezet?", answer: "Er is geen vaste bufferplek voor overloop." },
    { question: "Waarom is er geen bufferplek?", answer: "De lay-out van inbound is nooit op piekdrukte ingericht." },
    { question: "Waarom is de lay-out daar niet op ingericht?", answer: "Er zijn geen afspraken over buffercapaciteit bij pieken." },
    { question: "Waarom ontbreken die afspraken?", answer: "Piekdrukte is nooit meegenomen in de werkplekinrichting." },
  ],
};

const olielekkage: Omit<CoachForm, "tag" | "indicators"> = {
  description: "Er ligt een plas olie naast heftruck 3 in gang C. Medewerkers lopen eromheen; risico op uitglijden en grondvervuiling.",
  photo: olielekkageFoto,
  photoLabel: "Heftruck 3, gang C · lesvoorbeeld",
  where: "Gang C, bij stelling 14",
  what: "Olielekkage van heftruck 3 op de vloer.",
  why: "De hydrauliekslang lekt en het onderhoud is uitgesteld.",
  how: "Lekbak plaatsen en de hydrauliekslang laten vervangen. Neem de heftruck op in de vaste onderhoudsplanning.",
  whys: [
    { question: "Waarom ligt er olie op de vloer?", answer: "De hydrauliekslang van heftruck 3 lekt." },
    { question: "Waarom lekt de slang?", answer: "De slang is versleten en had al vervangen moeten zijn." },
    { question: "Waarom is de slang niet vervangen?", answer: "Het geplande onderhoud is uitgesteld." },
    { question: "Waarom is het onderhoud uitgesteld?", answer: "De monteur werd op andere storingen ingezet." },
    { question: "Waarom gebeurt dat steeds?", answer: "De onderhoudsplanning heeft geen prioriteit boven acute storingen." },
  ],
};

const tillen: Omit<CoachForm, "tag" | "indicators"> = {
  description: "Medewerkers tillen dozen van meer dan 20 kg vanaf vloerniveau met gebogen rug in de orderpickzone voor zware artikelen.",
  photo: tillenFoto,
  photoLabel: "Orderpick, zone zwaar · lesvoorbeeld",
  where: "Orderpick, zone zwaar",
  what: "Zwaar tillen vanaf lage pallets, de hele dienst door.",
  why: "Er is geen palletheffer beschikbaar in de zone, dus wordt vanaf de vloer getild.",
  how: "Palletheffers aanschaffen en de zone herindelen zodat tillen op hefhoogte gebeurt. Meet klachten en tilbelasting na invoering.",
  whys: [
    { question: "Waarom tillen medewerkers vanaf vloerniveau?", answer: "Er is geen palletheffer beschikbaar in de zone." },
    { question: "Waarom is er geen palletheffer?", answer: "Er zijn te weinig palletheffers voor alle zones." },
    { question: "Waarom zijn er te weinig?", answer: "De aanschaf van extra palletheffers is uitgesteld." },
    { question: "Waarom is de aanschaf uitgesteld?", answer: "Er is nog geen besluit genomen over het budget." },
    { question: "Waarom is er geen besluit?", answer: "De tilbelasting is nooit als structureel knelpunt aangemeld." },
  ],
};

export const examples: CoachForm[] = [
  { tag: "Kwaliteit", indicators: [], ...example },
  { tag: "Veiligheid", indicators: ["Gedragsregels"], ...nooduitgang },
  { tag: "Veiligheid", indicators: ["Incidenten"], ...olielekkage },
  { tag: "Personeel", indicators: ["Ziekteverzuim"], ...tillen },
];

export const emptyForm: CoachForm = {
  tag: "Veiligheid",
  indicators: [],
  description: "",
  photo: "",
  photoLabel: "",
  where: "",
  what: "",
  why: "",
  how: "",
  whys: Array.from({ length: 5 }, (_, i) => ({ question: `Waarom ${i + 1}?`, answer: "" })),
};

export const currentUser = "Sanne de Vries";

export const assignees = [
  { name: "Mark Janssen", role: "VGWM-coördinator" },
  { name: "Bram Hendriks", role: "Teamleider Expeditie" },
  { name: "Linda Bakker", role: "Teamleider Picking" },
  { name: "Joris van Dijk", role: "Heftruckchauffeur" },
  { name: "Eva Smits", role: "Milieucoördinator" },
];
