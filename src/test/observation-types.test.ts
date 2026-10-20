import { describe, expect, it } from "vitest";
import { TOPICS } from "@/data/types";
import { MOCK_ACTIONS, MOCK_OBSERVATIONS } from "@/data/mock";
import { emptyForm, examples, kpiMeasures } from "@/data/examples";

describe("Original observation categories", () => {
  it("uses the four original dashboard categories for every report", () => {
    expect(TOPICS).toEqual(["Veiligheid", "Kwaliteit", "Productiviteit", "Personeel"]);
    for (const row of [...MOCK_OBSERVATIONS, ...MOCK_ACTIONS]) {
      expect(TOPICS).toContain(row.topic);
    }
    for (const form of [emptyForm, ...examples]) {
      expect(TOPICS).toContain(form.tag);
      for (const indicator of form.indicators) {
        expect(kpiMeasures[form.tag]).toContain(indicator);
      }
    }
  });
});