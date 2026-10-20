import { Star, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { piShare, piWeight } from "@/lib/pi-weights";
import { cn } from "@/lib/utils";

export function AnalysisScore({ value, onChange, disabled, indicators, weights, onWeightsChange }: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
  indicators: string[];
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} aria-label="Analyse beoordelen" title="Analyse beoordelen">
          <Star className={cn(value !== null && "fill-current")} />
          {value === null ? "Score" : `${value}/5`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto" aria-label="Analyse beoordelen">
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
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">PI-gewichtenmatrix</h3>
            <Button variant="ghost" size="icon" disabled={disabled || Object.keys(weights).length === 0} aria-label="PI-weging herstellen" title="PI-weging herstellen" onClick={() => onWeightsChange({})}><RotateCcw className="size-3.5" /></Button>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>0 · geen gewicht</span><span>5 · hoogste gewicht</span></div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_100px_40px] gap-x-3 border-b pb-2 text-[11px] font-semibold text-muted-foreground">
            <span>Prestatieindicator</span><span>Weging</span><span className="text-right">Aandeel</span>
          </div>
          {indicators.map(indicator => (
            <div key={indicator} className="grid grid-cols-[minmax(0,1fr)_100px_40px] items-center gap-x-3 border-b py-3">
              <span className="break-words text-xs">{indicator}</span>
              <div className="flex items-center gap-2">
                <Slider aria-label={`Weging ${indicator}`} min={0} max={5} step={1} value={[piWeight(weights, indicator)]} disabled={disabled} onValueChange={values => { const next = values[0]; if (next !== undefined) onWeightsChange({ ...weights, [indicator]: next }); }} />
                <span className="w-6 shrink-0 text-right text-xs tabular-nums">{piWeight(weights, indicator)}/5</span>
              </div>
              <span className="text-right text-xs tabular-nums">{piShare(weights, indicators, indicator)}%</span>
            </div>
          ))}
          <p className="mt-3 text-[11px] text-muted-foreground">Fictief LoRA-scenario · niet opgeslagen · geen training</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}