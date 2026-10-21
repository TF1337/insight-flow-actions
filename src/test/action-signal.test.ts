import { describe, expect, it } from "vitest";
import { actionSignal } from "@/lib/sentinel";
import type { Action } from "@/data/types";

const ref = new Date("2026-10-21T00:00:00");
const base = { due: "2026-10-28", status: "In uitvoering" } as Action;

describe("kleurcode acties", () => {
  it("opgelost is groen", () => expect(actionSignal({ ...base, status: "Resultaat gecontroleerd" }, ref)).toBe("groen"));
  it("uitgevoerd is groen", () => expect(actionSignal({ ...base, status: "Uitgevoerd", due: "2026-10-01" }, ref)).toBe("groen"));
  it("nog in werking binnen termijn is oranje", () => expect(actionSignal(base, ref)).toBe("oranje"));
  it("verlopen termijn is rood", () => expect(actionSignal({ ...base, due: "2026-10-14" }, ref)).toBe("rood"));
});
