import { analysisSchema, type PhotoAnalysis } from "./photo-analysis";

export async function analysePhoto(image: string, zone: string, topic: string, signal: AbortSignal): Promise<PhotoAnalysis> {
  const source = await fetch(image, { signal });
  if (!source.ok) throw new Error("De foto kon niet worden gelezen.");
  const blob = await source.blob();
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("De foto kon niet worden gelezen."));
    reader.readAsDataURL(blob);
  });
  const response = await fetch("/api/analyse", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataURL, zone, topic }), signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "Fotoanalyse is momenteel niet beschikbaar.");
  }
  if (!response.body) throw new Error("Geen fotoanalyse ontvangen.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: PhotoAnalysis | undefined;
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "result") result = analysisSchema.parse(event.analysis);
      }
      if (chunk.done) break;
    }
  } finally { await reader.cancel(); }
  if (!result) throw new Error("Geen volledige analyse ontvangen; je invoer is behouden.");
  return result;
}