import { describe, expect, it } from "vitest";
import { examples, kpiMeasures, relevantMeasures } from "@/data/examples";

describe("Score measures by subject", () => {
  it("only offers safety measures for a safety report, even with productivity selections", () => {
    expect(relevantMeasures("Veiligheid", ["WPI direct", "WPL Index"])).toEqual([
      "Gedragsregels", "Aantal incidenten", "Near misses: 30 dagen",
    ]);
  });

  it("keeps relevant selections and discards other subjects", () => {
    expect(relevantMeasures("Veiligheid", ["Aantal incidenten", "WPI direct"])).toEqual(["Aantal incidenten"]);
  });

  it("offers each example's selected measures or its own subject's measures", () => {
    for (const example of examples) {
      const expected = example.indicators.length ? example.indicators : kpiMeasures[example.tag];
      expect(relevantMeasures(example.tag, example.indicators)).toEqual(expected);
    }
  });
});