import { z } from "zod";
import type { FrameworkSchema } from "./compute";

const FactorDefinitionSchema = z.object({
  slug: z.string(),
  label: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(1),
  range: z.object({ min: z.number(), max: z.number() }),
});

const FrameworkSchemaDefinition = z.object({
  version: z.number(),
  factors: z.array(FactorDefinitionSchema).min(1),
  compositeMethod: z.string(),
});

export function parseSchemaDefinition(json: string): FrameworkSchema {
  const parsed = JSON.parse(json);
  return FrameworkSchemaDefinition.parse(parsed);
}
