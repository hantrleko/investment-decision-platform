import type { ProvenanceSource } from "@/types";

export interface ProvenanceRecord {
  source: ProvenanceSource;
  artifactId?: string;
  timestamp: string;
  note?: string;
}

export function buildProvenance(
  source: ProvenanceSource,
  options?: { artifactId?: string; note?: string }
): string {
  const record: ProvenanceRecord = {
    source,
    timestamp: new Date().toISOString(),
    artifactId: options?.artifactId,
    note: options?.note,
  };
  return JSON.stringify(record);
}
