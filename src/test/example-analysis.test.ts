import { describe, expect, it } from "vitest";
import { MOCK_ACTIONS, MOCK_OBSERVATIONS } from "@/data/mock";
import { examples } from "@/data/examples";
import { W5H_KEYS } from "@/data/types";

describe("Complete example analyses", () => {
  for (const action of MOCK_ACTIONS) {
    it(`provides complete 5W1H and five RCA steps for ${action.id}`, () => {
      const observation = MOCK_OBSERVATIONS.find(o => o.id === action.observationId);
      expect(observation).toBeDefined();
      if (!observation) throw new Error(`Missing observation for ${action.id}`);
      for (const key of W5H_KEYS) expect(observation.w5h[key].trim().length).toBeGreaterThan(0);
      expect(observation.waaromOnbekend).toBe(false);
      expect(observation.whys).toHaveLength(5);
      for (const step of observation.whys ?? []) {
        expect(step.question.trim().length).toBeGreaterThan(0);
        expect(step.answer.trim().length).toBeGreaterThan(0);
      }
    });
  }

  it("provides complete editable analyses for all four lesson examples", () => {
    expect(examples).toHaveLength(4);
    for (const form of examples) {
      for (const key of ["where", "what", "why", "how"] as const) {
        expect(form[key].trim().length).toBeGreaterThan(0);
      }
      expect(form.whys).toHaveLength(5);
      for (const step of form.whys) {
        expect(step.question.trim().length).toBeGreaterThan(0);
        expect(step.answer.trim().length).toBeGreaterThan(0);
      }
    }
  });
});