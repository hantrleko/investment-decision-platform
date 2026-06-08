export interface FactorDefinition {
  slug: string;
  label: string;
  description: string;
  weight: number;
  range: { min: number; max: number };
}

export interface FrameworkSchema {
  version: number;
  factors: FactorDefinition[];
  compositeMethod: string;
}

export interface FactorScore {
  value: number;
  note?: string;
}

export function computeComposite(
  schema: FrameworkSchema,
  factorScores: Record<string, FactorScore>
): number {
  let total = 0;
  for (const factor of schema.factors) {
    const score = factorScores[factor.slug];
    if (!score) continue;
    total += score.value * factor.weight;
  }
  return total;
}
