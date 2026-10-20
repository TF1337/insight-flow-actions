import { describe, expect, it } from "vitest";
import { piShare, piWeight } from "@/lib/pi-weights";

describe("Fictitious PI weighting", () => {
  it("gives unassigned indicators a neutral default", () => {
    expect(piWeight({}, "Gedragsregels")).toBe(3);
  });
  it("keeps the scale between zero and five", () => {
    expect(piWeight({ a: -1 }, "a")).toBe(0);
    expect(piWeight({ a: 6 }, "a")).toBe(5);
  });
  it("calculates relative weighting only from the current indicators", () => {
    expect(piShare({ a: 4, b: 1, c: 5 }, ["a", "b"], "a")).toBe(80);
  });
  it("does not divide by zero when every PI is disabled", () => {
    expect(piShare({ a: 0, b: 0 }, ["a", "b"], "a")).toBe(0);
  });
});