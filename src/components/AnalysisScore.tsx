import { Star, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function AnalysisScore({ value, onChange, disabled }: { value: number | null; onChange: (value: number | null) => void; disabled: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} aria-label="Analyse beoordelen" title="Analyse beoordelen">
          <Star className={cn(value !== null && "fill-current")} />
          {value === null ? "Score" : `${value}/5`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64" aria-label="Analyse beoordelen">
        <h3 className="text-sm font-semibold">Analyse beoordelen</h3>
        <div className="mt-3 flex gap-1" role="group" aria-label="Score">
          {[1, 2, 3, 4, 5].map(score => (
            <Button key={score} variant="ghost" size="icon" aria-label={`${score} ${score === 1 ? "ster" : "sterren"}`} aria-pressed={value === score} title={`${score}/5`} onClick={() => onChange(score)}>
              <Star className={cn("size-5", value !== null && score <= value ? "fill-current text-primary" : "text-muted-foreground")} />
            </Button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground" role="status">{value === null ? "Geen score" : `${value}/5 · niet opgeslagen`}</span>
          <Button variant="ghost" size="icon" disabled={value === null} aria-label="Score wissen" title="Score wissen" onClick={() => onChange(null)}><RotateCcw className="size-3.5" /></Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}