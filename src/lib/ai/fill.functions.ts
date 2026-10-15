import { createServerFn, getRequest } from "@tanstack/react-start";
import { z } from "zod";

import { generateFieldSuggestions, type FillResult } from "./fill.server";

const inputSchema = z.object({
  title: z.string(),
  topic: z.string(),
  dept: z.string(),
  deviation: z.string(),
  missing: z.array(z.enum(["where", "what", "why", "how", "whys"])).min(1),
  current: z.object({
    where: z.string(),
    what: z.string(),
    why: z.string(),
    how: z.string(),
  }),
});

export const suggestActionFields = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<FillResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "De AI is niet geconfigureerd." };
    }
    return generateFieldSuggestions(getRequest(), apiKey, data);
  });
