"use server";

import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { computeAutoEvaluation, type FrameworkSlug } from "@/lib/autoscore";
import { computeComposite } from "@/lib/scoring/compute";
import { parseSchemaDefinition } from "@/lib/scoring/schema-parser";
import { buildProvenance } from "@/lib/scoring/provenance";
import { runStrategy } from "@/actions/strategies";
import { revalidatePath } from "next/cache";

const FRAMEWORK_SLUGS: FrameworkSlug[] = ["valuation", "macro", "trend"];

export interface AutoEvaluateOptions {
  ticker: string;
  /** Strategy to run after scores are written. Default: multi-signal-gate. Pass null to skip. */
  strategySlug?: string | null;
  /** Create a research artifact from the auto markdown report. Default true. */
  createResearch?: boolean;
  /** Update asset name/sector/price from fundamentals when missing or stale. Default true. */
  updateAssetMeta?: boolean;
}

export interface AutoEvaluateScoreSummary {
  id: string;
  frameworkSlug: string;
  frameworkName: string;
  compositeScore: number;
}

export interface AutoEvaluateResult {
  ticker: string;
  scores: AutoEvaluateScoreSummary[];
  researchId: string | null;
  recommendationId: string | null;
  recommendation: string | null;
  warnings: string[];
  composites: Record<string, number | null>;
}

/**
 * One-click auto evaluation:
 * 1. Ensure asset exists (create from Yahoo fundamentals if needed)
 * 2. Fetch fundamentals + OHLCV → map Valuation / Trend / Macro factors
 * 3. Persist scores with provenance source "auto"
 * 4. Optionally create research artifact + run strategy
 */
export async function autoEvaluateAsset(
  input: AutoEvaluateOptions
): Promise<{ data?: AutoEvaluateResult; error?: string }> {
  const session = await verifySession();
  if (!session) {
    return { error: "Session expired. Please sign out and sign in again." };
  }

  const ticker = (input.ticker || "").trim().toUpperCase();
  if (!ticker) {
    return { error: "Ticker is required" };
  }
  if (!/^[A-Z0-9.\-^]{1,12}$/.test(ticker)) {
    return { error: `Invalid ticker "${ticker}"` };
  }

  const createResearch = input.createResearch !== false;
  const updateAssetMeta = input.updateAssetMeta !== false;
  const strategySlug =
    input.strategySlug === null
      ? null
      : input.strategySlug?.trim() || "multi-signal-gate";

  try {
    // Load active frameworks first so we can pass schemas into the pipeline
    const frameworks = await prisma.framework.findMany({
      where: { slug: { in: FRAMEWORK_SLUGS }, isActive: true },
    });
    if (frameworks.length === 0) {
      return {
        error:
          "No active frameworks found. Run db seed to install Valuation/Macro/Trend.",
      };
    }

    const schemaBySlug: Partial<
      Record<FrameworkSlug, ReturnType<typeof parseSchemaDefinition>>
    > = {};
    const frameworkBySlug = new Map(frameworks.map((f) => [f.slug, f]));

    for (const fw of frameworks) {
      try {
        schemaBySlug[fw.slug as FrameworkSlug] = parseSchemaDefinition(
          fw.schemaDefinition
        );
      } catch {
        // Composite will fall back to unweighted mean in the pipeline
      }
    }

    // Pure compute (Yahoo fetch + mappers)
    const computed = await computeAutoEvaluation(ticker, {
      schemas: schemaBySlug,
    });

    // Ensure asset row exists; enrich meta from fundamentals
    let asset = await prisma.asset.findUnique({ where: { ticker } });
    const f = computed.fundamentals;

    if (!asset) {
      asset = await prisma.asset.create({
        data: {
          ticker,
          name: f.name || ticker,
          sector: f.sector || null,
          exchange: f.exchange || null,
          assetType: "equity",
          lastPrice: f.regularMarketPrice ?? null,
          lastPriceTs: f.regularMarketPrice != null ? new Date() : null,
          priceSource: f.regularMarketPrice != null ? "yahoo" : null,
        },
      });
    } else if (updateAssetMeta) {
      asset = await prisma.asset.update({
        where: { ticker },
        data: {
          name: asset.name === asset.ticker && f.name ? f.name : asset.name,
          sector: asset.sector || f.sector || null,
          exchange: asset.exchange || f.exchange || null,
          lastPrice: f.regularMarketPrice ?? asset.lastPrice,
          lastPriceTs:
            f.regularMarketPrice != null ? new Date() : asset.lastPriceTs,
          priceSource:
            f.regularMarketPrice != null ? "yahoo" : asset.priceSource,
        },
      });
    }

    // Optional research artifact
    let researchId: string | null = null;
    if (createResearch) {
      const artifact = await prisma.researchArtifact.create({
        data: {
          title: `Auto Evaluation — ${ticker} (${new Date().toISOString().slice(0, 10)})`,
          content: computed.researchMarkdown,
          contentType: "markdown",
          tags: "auto,valuation,trend,macro",
          assetTicker: ticker,
          authorId: session.user.id,
        },
      });
      researchId = artifact.id;
    }

    // Persist one score per framework
    const scoreSummaries: AutoEvaluateScoreSummary[] = [];
    const composites: Record<string, number | null> = {};

    for (const fwResult of computed.frameworks) {
      const framework = frameworkBySlug.get(fwResult.slug);
      if (!framework) {
        computed.warnings.push(
          `Framework "${fwResult.slug}" not found or inactive — skipped`
        );
        continue;
      }

      const schema = schemaBySlug[fwResult.slug];
      const compositeScore = schema
        ? computeComposite(schema, fwResult.factorScores)
        : (fwResult.compositePreview ?? 0);

      const provenance = buildProvenance("auto", {
        artifactId: researchId ?? undefined,
        note: `Auto-evaluated via Yahoo fundamentals + OHLCV (${fwResult.slug})${
          fwResult.warnings.length
            ? `; warnings: ${fwResult.warnings.join("; ")}`
            : ""
        }`,
      });

      const score = await prisma.score.create({
        data: {
          frameworkId: framework.id,
          assetTicker: ticker,
          researchArtifactId: researchId,
          factorScores: JSON.stringify(fwResult.factorScores),
          compositeScore,
          provenance,
        },
      });

      scoreSummaries.push({
        id: score.id,
        frameworkSlug: framework.slug,
        frameworkName: framework.name,
        compositeScore,
      });
      composites[framework.slug] = compositeScore;
    }

    if (scoreSummaries.length === 0) {
      return {
        error:
          "No scores were created. Ensure Valuation/Macro/Trend frameworks are seeded and active.",
      };
    }

    // Run strategy on freshly written scores
    let recommendationId: string | null = null;
    let recommendation: string | null = null;

    if (strategySlug) {
      const stratResult = await runStrategy({
        strategySlug,
        assetTicker: ticker,
      });
      if (stratResult.error) {
        computed.warnings.push(`Strategy run skipped: ${stratResult.error}`);
      } else if (stratResult.data) {
        recommendationId = stratResult.data.id;
        recommendation = stratResult.data.recommendation;
      }
    }

    revalidatePath(`/assets/${ticker}`);
    revalidatePath("/scores");
    revalidatePath("/research");
    revalidatePath("/strategies");
    revalidatePath("/assets");

    return {
      data: {
        ticker,
        scores: scoreSummaries,
        researchId,
        recommendationId,
        recommendation,
        warnings: computed.warnings,
        composites,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Auto evaluation failed";
    return { error: message };
  }
}
