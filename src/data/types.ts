export type Topic = "Veiligheid" | "Welzijn" | "Gezondheid" | "Milieu";
export const TOPICS: Topic[] = ["Veiligheid", "Welzijn", "Gezondheid", "Milieu"];

export type Signal = "groen" | "oranje" | "rood";

export type Status = "Open" | "In uitvoering" | "Wacht op besluit" | "Uitgevoerd" | "Resultaat gecontroleerd";
export const STATUSES: Status[] = ["Open", "In uitvoering", "Wacht op besluit", "Uitgevoerd", "Resultaat gecontroleerd"];

export type Priority = "Actie / Just Do It" | "PDCA / 6S" | "Change";
export const PRIORITIES: Priority[] = ["Actie / Just Do It", "PDCA / 6S", "Change"];

export type W5H = { wie: string; wat: string; waar: string; wanneer: string; waarom: string; hoe: string };
export const W5H_KEYS: (keyof W5H)[] = ["wie", "wat", "waar", "wanneer", "waarom", "hoe"];
export const W5H_LABEL: Record<keyof W5H, string> = {
  wie: "Wie",
  wat: "Wat",
  waar: "Waar",
  wanneer: "Wanneer",
  waarom: "Waarom",
  hoe: "Hoe",
};

export type Why = { question: string; answer: string };

export type Observation = {
  id: string;
  title: string;
  description: string;
  photo?: string | undefined;
  dept: string;
  topic: Topic;
  signal: Signal;
  reporter: string;
  createdAt: string;
  w5h: W5H;
  whys?: Why[] | undefined;
  waaromOnbekend: boolean;
};

export type Feedback = { id: string; date: string; author: string; text: string };

export type Action = {
  id: string;
  title: string;
  observationId?: string | undefined;
  kpi: string;
  deviation: string;
  topic: Topic;
  dept: string;
  owner: string;
  due: string; // yyyy-mm-dd of ""
  priority: Priority;
  status: Status;
  feedback: Feedback[];
  gedaan: string;
  resultaat: string;
  createdAt: string;
};
