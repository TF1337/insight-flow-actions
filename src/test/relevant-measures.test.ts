import { describe, expect, it } from "vitest";
import { examples, kpiMeasures, relevantMeasures } from "@/data/examples";

const VEILIGHEID = ["Gedragsregels", "Incidenten met letsel", "Incidenten zonder letsel", "Near misses: 30 dagen"];

describe("Score measures by subject", () => {
  it("only offers safety measures for a safety report, even with productivity selections", () => {
    expect(relevantMeasures("Veiligheid", ["WPI direct", "WPL Index"])).toEqual(VEILIGHEID);
  });

  it("keeps relevant selections and discards other subjects", () => {
    expect(relevantMeasures("Veiligheid", ["Gedragsregels", "WPI direct"])).toEqual(["Gedragsregels"]);
  });

  it("offers no separate Incidenten PI anymore", () => {
    expect(kpiMeasures.Veiligheid).not.toContain("Incidenten");
    expect(relevantMeasures("Veiligheid", ["Incidenten"])).toEqual(VEILIGHEID);
  });

  it("keeps the three incident measures as separate PI's", () => {
    expect(relevantMeasures("Veiligheid", ["Incidenten met letsel", "Near misses: 30 dagen"])).toEqual([
      "Incidenten met letsel",
      "Near misses: 30 dagen",
    ]);
  });

  it("offers each example's selected measures or its own subject's measures", () => {
    for (const example of examples) {
      const expected = example.indicators.length ? relevantMeasures(example.tag, example.indicators) : kpiMeasures[example.tag];
      expect(relevantMeasures(example.tag, example.indicators)).toEqual(expected);
    }
  });
});
