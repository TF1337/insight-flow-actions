import { describe, expect, it } from "vitest";
import { emptyForm } from "@/data/examples";
import { applyPhotoAnalysis } from "@/lib/photo-analysis";

const analysis = { what: "Dozen blokkeren de nooduitgang.", why: "Hypothese, te toetsen: bufferafspraken ontbreken.", how: "Maak de uitgang vrij en toets de bufferafspraken.", whys: Array.from({ length: 5 }, (_, i) => ({ question: `Waarom stap ${i + 1}?`, answer: `Hypothese, te toetsen: oorzaak ${i + 1}.` })) };
describe("Photo analysis form rules", () => {
  it("preserves the preselected zone while filling What and Why", () => {
    const result = applyPhotoAnalysis({ ...emptyForm, where: "Outbound" }, analysis);
    expect(result.where).toBe("Outbound");
    expect(result.what).toBe("Dozen blokkeren de nooduitgang.");
    expect(result.why).toBe("Hypothese, te toetsen: bufferafspraken ontbreken.");
  });
  it("requires exactly five why steps", () => {
    expect(applyPhotoAnalysis(emptyForm, analysis).whys).toHaveLength(5);
    expect(() => applyPhotoAnalysis(emptyForm, { ...analysis, whys: analysis.whys.slice(0, 4) })).toThrow();
  });
  it("does not replace the selected topic, photo or indicators", () => {
    const result = applyPhotoAnalysis({ ...emptyForm, tag: "Productiviteit", photo: "photo.jpg", indicators: ["WPI direct"] }, analysis);
    expect(result.tag).toBe("Productiviteit");
    expect(result.photo).toBe("photo.jpg");
    expect(result.indicators).toEqual(["WPI direct"]);
  });
});