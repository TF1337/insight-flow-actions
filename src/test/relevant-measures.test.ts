import { describe, expect, it } from "vitest";
import { examples, isSubMeasure, kpiMeasures, relevantMeasures } from "@/data/examples";

const VEILIGHEID = ["Gedragsregels", "Incidenten", "Incidenten met letsel", "Incidenten zonder letsel", "Near misses: 30 dagen"];

describe("Score measures by subject", () => {
  it("only offers safety measures for a safety report, even with productivity selections", () => {
    expect(relevantMeasures("Veiligheid", ["WPI direct", "WPL Index"])).toEqual(VEILIGHEID);
  });

  it("keeps relevant selections and discards other subjects", () => {
    expect(relevantMeasures("Veiligheid", ["Gedragsregels", "WPI direct"])).toEqual(["Gedragsregels"]);
  });

  it("expands the Incidenten PI into its sub-measures", () => {
    expect(relevantMeasures("Veiligheid", ["Incidenten"])).toEqual([
      "Incidenten", "Incidenten met letsel", "Incidenten zonder letsel", "Near misses: 30 dagen",
    ]);
  });

  it("adds the parent PI when only a sub-measure is selected", () => {
    expect(relevantMeasures("Veiligheid", ["Near misses: 30 dagen"])).toEqual(["Incidenten", "Near misses: 30 dagen"]);
  });

  it("marks the three incident types as sub-measures of Incidenten", () => {
    expect(isSubMeasure("Incidenten")).toBe(false);
    expect(isSubMeasure("Incidenten met letsel")).toBe(true);
    expect(isSubMeasure("Incidenten zonder letsel")).toBe(true);
    expect(isSubMeasure("Near misses: 30 dagen")).toBe(true);
  });

  it("offers each example's selected measures or its own subject's measures", () => {
    for (const example of examples) {
      const expected = example.indicators.length ? relevantMeasures(example.tag, example.indicators) : kpiMeasures[example.tag];
      expect(relevantMeasures(example.tag, example.indicators)).toEqual(expected);
    }
  });
});
