import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/analyse")({
  server: { handlers: { POST: async ({ request }) => {
    const { handlePhotoAnalysis } = await import("@/lib/ai/photo-analysis.server");
    return handlePhotoAnalysis(request);
  } } },
});