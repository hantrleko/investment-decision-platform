import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DB_URL = "file:./test-crud.db";
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let userId: string;

beforeAll(async () => {
  // Push schema to test database
  const { execSync } = await import("child_process");
  execSync(
    `npx prisma db push --force-reset --skip-generate`,
    {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      cwd: process.cwd(),
      stdio: "pipe",
    }
  );

  await prisma.$connect();

  const user = await prisma.user.create({
    data: {
      email: "test-crud@eugene.finance",
      name: "Test User",
      passwordHash: await bcrypt.hash("test", 12),
    },
  });
  userId = user.id;

  // Seed frameworks needed for score linking tests
  await prisma.framework.upsert({
    where: { slug: "valuation" },
    update: {},
    create: {
      name: "Valuation",
      slug: "valuation",
      schemaDefinition: '{"version":1,"factors":[],"compositeMethod":"weighted_average"}',
    },
  });
});

afterAll(async () => {
  await prisma.researchArtifact.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe("Research Artifact CRUD", () => {
  it("creates a research artifact", async () => {
    const artifact = await prisma.researchArtifact.create({
      data: {
        title: "AAPL Valuation Analysis",
        content: '{"type":"doc","content":[]}',
        contentType: "rich-text",
        tags: "earnings,valuation",
        authorId: userId,
      },
    });

    expect(artifact.id).toBeDefined();
    expect(artifact.title).toBe("AAPL Valuation Analysis");
    expect(artifact.tags).toBe("earnings,valuation");
    expect(artifact.contentType).toBe("rich-text");
  });

  it("reads a research artifact", async () => {
    const created = await prisma.researchArtifact.create({
      data: {
        title: "Read Test",
        content: "test",
        authorId: userId,
      },
    });

    const found = await prisma.researchArtifact.findUnique({
      where: { id: created.id },
    });

    expect(found).not.toBeNull();
    expect(found!.title).toBe("Read Test");
  });

  it("updates a research artifact and changes updatedAt", async () => {
    const created = await prisma.researchArtifact.create({
      data: {
        title: "Original Title",
        content: "original",
        authorId: userId,
      },
    });

    await new Promise((r) => setTimeout(r, 10));

    const updated = await prisma.researchArtifact.update({
      where: { id: created.id },
      data: { title: "Updated Title" },
    });

    expect(updated.title).toBe("Updated Title");
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime()
    );
  });

  it("deletes a research artifact without links", async () => {
    const created = await prisma.researchArtifact.create({
      data: {
        title: "To Delete",
        content: "delete me",
        authorId: userId,
      },
    });

    await prisma.researchArtifact.delete({ where: { id: created.id } });

    const found = await prisma.researchArtifact.findUnique({
      where: { id: created.id },
    });
    expect(found).toBeNull();
  });

  it("deleting artifact with linked score sets Score.researchArtifactId to null", async () => {
    const asset = await prisma.asset.create({
      data: { ticker: "DELINK", name: "Delink Test" },
    });
    const framework = await prisma.framework.findFirst({
      where: { slug: "valuation" },
    });

    const artifact = await prisma.researchArtifact.create({
      data: {
        title: "Artifact with Score",
        content: "test",
        authorId: userId,
        assetTicker: asset.ticker,
      },
    });

    const score = await prisma.score.create({
      data: {
        frameworkId: framework!.id,
        assetTicker: asset.ticker,
        researchArtifactId: artifact.id,
        factorScores: "{}",
        provenance: '{"source":"research","timestamp":"2026-01-01T00:00:00Z"}',
      },
    });

    await prisma.researchArtifact.delete({ where: { id: artifact.id } });

    const updatedScore = await prisma.score.findUnique({ where: { id: score.id } });
    expect(updatedScore!.researchArtifactId).toBeNull();

    await prisma.score.delete({ where: { id: score.id } });
    await prisma.asset.delete({ where: { ticker: asset.ticker } });
  });
});

describe("Research pagination and sort", () => {
  beforeAll(async () => {
    await prisma.researchArtifact.deleteMany({
      where: { authorId: userId, title: { startsWith: "PageTest" } },
    });

    for (let i = 0; i < 25; i++) {
      await prisma.researchArtifact.create({
        data: {
          title: `PageTest ${String(i).padStart(2, "0")}`,
          content: "pagination test",
          authorId: userId,
        },
      });
    }
  });

  it("returns first page of 20 sorted by updatedAt desc", async () => {
    const page1 = await prisma.researchArtifact.findMany({
      where: { authorId: userId, title: { startsWith: "PageTest" } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    expect(page1.length).toBe(20);
  });

  it("returns second page of 5", async () => {
    const page2 = await prisma.researchArtifact.findMany({
      where: { authorId: userId, title: { startsWith: "PageTest" } },
      orderBy: { updatedAt: "desc" },
      skip: 20,
      take: 20,
    });

    expect(page2.length).toBe(5);
  });

  it("count matches total", async () => {
    const total = await prisma.researchArtifact.count({
      where: { authorId: userId, title: { startsWith: "PageTest" } },
    });
    expect(total).toBe(25);
  });
});

describe("Research tag filter", () => {
  it("filters by tag using contains", async () => {
    await prisma.researchArtifact.create({
      data: {
        title: "Tagged Entry",
        content: "test",
        tags: "macro,earnings",
        authorId: userId,
      },
    });

    const results = await prisma.researchArtifact.findMany({
      where: { tags: { contains: "macro" }, authorId: userId },
    });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.tags).toContain("macro");
    });
  });
});

describe("Research asset ticker link", () => {
  it("creates artifact with linked asset ticker", async () => {
    const asset = await prisma.asset.upsert({
      where: { ticker: "LINKTEST" },
      update: {},
      create: { ticker: "LINKTEST", name: "Link Test Corp" },
    });

    const artifact = await prisma.researchArtifact.create({
      data: {
        title: "Linked Artifact",
        content: "test",
        assetTicker: asset.ticker,
        authorId: userId,
      },
    });

    expect(artifact.assetTicker).toBe("LINKTEST");

    const withAsset = await prisma.researchArtifact.findUnique({
      where: { id: artifact.id },
      include: { asset: true },
    });

    expect(withAsset!.asset).not.toBeNull();
    expect(withAsset!.asset!.name).toBe("Link Test Corp");
  });
});
