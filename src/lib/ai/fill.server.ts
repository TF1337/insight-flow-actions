import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export type FillField = "where" | "what" | "why" | "how" | "whys";

export type FillInput = {
  title: string;
  topic: string;
  dept: string;
  deviation: string;
  missing: FillField[];
  current: { where: string; what: string; why: string; how: string };
};

const fillSchema = z.object({
  waar: z.string().nullable(),
  wat: z.string().nullable(),
  waarom: z.string().nullable(),
  hoe: z.string().nullable(),
  whys: z.array(z.object({ question: z.string(), answer: z.string() })).nullable(),
});

export type FillResult =
  | { ok: true; fields: z.infer<typeof fillSchema> }
  | { ok: false; error: string };

const FIELD_LABELS: Record<FillField, string> = {
  where: "waar (werkplek of locatie, kort)",
  what: "wat (feitelijke waarneming van het probleem, 1-2 zinnen)",
  why: "waarom (vermoedelijke grondoorzaak, 1-2 zinnen)",
  how: "hoe (concrete maatregel en controle die de oorzaak aanpakt, 2-3 zinnen)",
  whys: "whys (een 5x waarom-analyse: exact 5 opeenvolgende waarom-vragen met antwoorden die afdalen naar de grondoorzaak)",
};

export async function generateFieldSuggestions(
  request: Request,
  apiKey: string,
  input: FillInput,
): Promise<FillResult> {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const wanted = input.missing.map((field) => `- ${FIELD_LABELS[field]}`).join("\n");
  const known = [
    input.current.where && `Waar (al ingevuld): ${input.current.where}`,
    input.current.what && `Wat (al ingevuld): ${input.current.what}`,
    input.current.why && `Waarom (al ingevuld): ${input.current.why}`,
    input.current.how && `Hoe (al ingevuld): ${input.current.how}`,
  ]
    .filter(Boolean)
    .join("\n");

  const instructions = [
    "Je bent een verbetercoach in een logistiek warehouse. Je helpt een actie onder de KPI Levertijd Zorg scherp te krijgen.",
    "Vul ALLEEN de gevraagde lege velden in met een logische, concrete redenatie die past bij de actie en de al ingevulde velden.",
    "Schrijf in het Nederlands, feitelijk en zonder inleiding. Gebruik null voor velden die niet gevraagd zijn.",
  ].join(" ");

  const prompt = [
    `Actie: ${input.title}`,
    `Onderwerp: ${input.topic}`,
    `Afdeling: ${input.dept}`,
    `Afwijking: ${input.deviation}`,
    known ? `\nReeds ingevuld:\n${known}` : "",
    `\nVul deze lege velden in:\n${wanted}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions,
      messages: [{ role: "user", content: prompt }],
      abortSignal: request.signal,
      output: Output.object({ schema: fillSchema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    try {
      const output = await result.output;
      return { ok: true, fields: output };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const text = error.text?.trim();
        if (text) {
          try {
            return { ok: true, fields: fillSchema.parse(JSON.parse(text)) };
          } catch {
            // fall through to the explicit error below
          }
        }
        return { ok: false, error: "De AI gaf geen bruikbaar antwoord. Probeer het opnieuw." };
      }
      throw error;
    }
  } catch (error) {
    if (request.signal.aborted && error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Het invullen is gestopt." };
    }
    const status =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined;
    const message =
      typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "";
    if (status === 402 || status === 403) {
      return { ok: false, error: message || "De AI is tijdelijk niet beschikbaar voor deze werkruimte." };
    }
    if (status === 429 || (status !== undefined && status >= 500)) {
      return { ok: false, error: "De AI is tijdelijk overbelast. Wacht even en probeer het opnieuw." };
    }
    return { ok: false, error: message || "Het invullen met AI is mislukt. Probeer het opnieuw." };
  }
}
