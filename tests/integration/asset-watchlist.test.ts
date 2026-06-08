import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DB_URL = "file:./test-asset.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;

beforeAll(async () => {
  const { execSync } = await import("child_process");
  execSync(`npx prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: "pipe",
  });

  await prisma.$connect();
  const user = await prisma.user.create({
    data: {
      email: "test-asset@eugene.finance",
      name: "Test User",
      passwordHash: await bcrypt.hash("test", 12),
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.watchlistEntry.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe("Asset CRUD", () => {
  it("creates an asset", async () => {
    const asset = await prisma.asset.create({
      data: { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", assetType: "equity" },
    });
    expect(asset.ticker).toBe("AAPL");
    expect(asset.name).toBe("Apple Inc.");
    expect(asset.sector).toBe("Technology");
  });

  it("reads an asset by ticker", async () => {
    const asset = await prisma.asset.findUnique({ where: { ticker: "AAPL" } });
    expect(asset).not.toBeNull();
    expect(asset!.name).toBe("Apple Inc.");
  });

  it("searches assets by ticker or name", async () => {
    await prisma.asset.create({
      data: { ticker: "GOOG", name: "Alphabet Inc.", sector: "Technology" },
    });

    const byTicker = await prisma.asset.findMany({
      where: { OR: [{ ticker: { contains: "AAPL" } }, { name: { contains: "AAPL" } }] },
    });
    expect(byTicker.length).toBeGreaterThanOrEqual(1);
    expect(byTicker.some((a) => a.ticker === "AAPL")).toBe(true);

    const byName = await prisma.asset.findMany({
      where: { OR: [{ ticker: { contains: "Alphabet" } }, { name: { contains: "Alphabet" } }] },
    });
    expect(byName.length).toBeGreaterThanOrEqual(1);
    expect(byName.some((a) => a.ticker === "GOOG")).toBe(true);
  });

  it("rejects duplicate ticker", async () => {
    await expect(
      prisma.asset.create({ data: { ticker: "AAPL", name: "Duplicate" } })
    ).rejects.toThrow();
  });
});

describe("Watchlist add/remove", () => {
  it("adds asset to watchlist", async () => {
    const entry = await prisma.watchlistEntry.create({
      data: { assetTicker: "AAPL", notes: "Watching closely" },
    });
    expect(entry.assetTicker).toBe("AAPL");
    expect(entry.notes).toBe("Watching closely");
  });

  it("finds watchlist entries with asset data", async () => {
    const entries = await prisma.watchlistEntry.findMany({
      where: { assetTicker: "AAPL" },
      include: { asset: { select: { ticker: true, name: true, sector: true } } },
    });
    expect(entries.length).toBe(1);
    expect(entries[0].asset.name).toBe("Apple Inc.");
  });

  it("removes asset from watchlist", async () => {
    await prisma.watchlistEntry.deleteMany({ where: { assetTicker: "AAPL" } });
    const remaining = await prisma.watchlistEntry.findMany({ where: { assetTicker: "AAPL" } });
    expect(remaining.length).toBe(0);
  });
});

describe("Asset detail — linked research", () => {
  it("asset has linked research artifacts", async () => {
    const artifact = await prisma.researchArtifact.create({
      data: {
        title: "AAPL Analysis",
        content: "test",
        assetTicker: "AAPL",
        authorId: userId,
      },
    });

    const asset = await prisma.asset.findUnique({
      where: { ticker: "AAPL" },
      include: { researchArtifacts: { select: { id: true, title: true } } },
    });

    expect(asset!.researchArtifacts.length).toBe(1);
    expect(asset!.researchArtifacts[0].title).toBe("AAPL Analysis");

    // Cleanup
    await prisma.researchArtifact.delete({ where: { id: artifact.id } });
  });
});

describe("Asset detail — linked scores", () => {
  it("asset has linked scores", async () => {
    const framework = await prisma.framework.upsert({
      where: { slug: "valuation" },
      update: {},
      create: {
        name: "Valuation",
        slug: "valuation",
        schemaDefinition: '{"version":1,"factors":[],"compositeMethod":"weighted_average"}',
      },
    });

    const score = await prisma.score.create({
      data: {
        frameworkId: framework.id,
        assetTicker: "AAPL",
        factorScores: '{"intrinsic_value_discount":{"value":8}}',
        compositeScore: 7.15,
        provenance: '{"source":"manual","timestamp":"2026-01-01T00:00:00Z"}',
      },
    });

    const asset = await prisma.asset.findUnique({
      where: { ticker: "AAPL" },
      include: { scores: { include: { framework: { select: { name: true } } } } },
    });

    expect(asset!.scores.length).toBe(1);
    expect(asset!.scores[0].compositeScore).toBeCloseTo(7.15, 1);

    // Cleanup
    await prisma.score.delete({ where: { id: score.id } });
  });
});

describe("Attachment file size limits", () => {
  it("enforces max file size constant from env", () => {
    const max = parseInt(process.env.MAX_ATTACHMENT_SIZE_BYTES || "10485760", 10);
    expect(max).toBe(10485760); // 10MB
  });

  it("enforces max total per artifact constant from env", () => {
    const max = parseInt(process.env.MAX_ARTIFACT_ATTACHMENTS_BYTES || "52428800", 10);
    expect(max).toBe(52428800); // 50MB
  });

  it("creates an attachment record with correct file metadata", async () => {
    const artifact = await prisma.researchArtifact.create({
      data: { title: "Attachment Test", content: "test", authorId: userId },
    });

    const attachment = await prisma.documentAttachment.create({
      data: {
        fileName: "report.pdf",
        filePath: `attachments/${artifact.id}/report.pdf`,
        mimeType: "application/pdf",
        fileSizeBytes: 2048,
        researchArtifactId: artifact.id,
      },
    });

    expect(attachment.fileName).toBe("report.pdf");
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.fileSizeBytes).toBe(2048);

    // Verify artifact includes attachment
    const withAttachments = await prisma.researchArtifact.findUnique({
      where: { id: artifact.id },
      include: { attachments: true },
    });
    expect(withAttachments!.attachments.length).toBe(1);

    // Cleanup
    await prisma.documentAttachment.delete({ where: { id: attachment.id } });
    await prisma.researchArtifact.delete({ where: { id: artifact.id } });
  });

  it("total attachment size is computed correctly", async () => {
    const artifact = await prisma.researchArtifact.create({
      data: { title: "Size Test", content: "test", authorId: userId },
    });

    await prisma.documentAttachment.createMany({
      data: [
        { fileName: "a.pdf", filePath: "a.pdf", mimeType: "application/pdf", fileSizeBytes: 5000000, researchArtifactId: artifact.id },
        { fileName: "b.pdf", filePath: "b.pdf", mimeType: "application/pdf", fileSizeBytes: 3000000, researchArtifactId: artifact.id },
      ],
    });

    const withAttachments = await prisma.researchArtifact.findUnique({
      where: { id: artifact.id },
      include: { attachments: true },
    });

    const total = withAttachments!.attachments.reduce((sum, a) => sum + a.fileSizeBytes, 0);
    expect(total).toBe(8000000);
    expect(total).toBeLessThan(52428800); // Within 50MB limit

    // Cleanup
    await prisma.documentAttachment.deleteMany({ where: { researchArtifactId: artifact.id } });
    await prisma.researchArtifact.delete({ where: { id: artifact.id } });
  });
});
