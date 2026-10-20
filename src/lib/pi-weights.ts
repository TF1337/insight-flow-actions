export const DEFAULT_PI_WEIGHT = 3;

export function piWeight(weights: Record<string, number>, indicator: string): number {
  const value = weights[indicator] ?? DEFAULT_PI_WEIGHT;
  return Number.isFinite(value) ? Math.min(5, Math.max(0, Math.round(value))) : DEFAULT_PI_WEIGHT;
}

export function piShare(weights: Record<string, number>, indicators: string[], indicator: string): number {
  const total = indicators.reduce((sum, item) => sum + piWeight(weights, item), 0);
  return total === 0 ? 0 : Math.round(piWeight(weights, indicator) / total * 100);
}