-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
    "ticker" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "assetType" TEXT NOT NULL DEFAULT 'equity',
    "exchange" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "schemaDefinition" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResearchArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'rich-text',
    "tags" TEXT NOT NULL DEFAULT '',
    "assetTicker" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchArtifact_assetTicker_fkey" FOREIGN KEY ("assetTicker") REFERENCES "Asset" ("ticker") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResearchArtifact_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "researchArtifactId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAttachment_researchArtifactId_fkey" FOREIGN KEY ("researchArtifactId") REFERENCES "ResearchArtifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkId" TEXT NOT NULL,
    "assetTicker" TEXT NOT NULL,
    "researchArtifactId" TEXT,
    "factorScores" TEXT NOT NULL,
    "compositeScore" REAL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideNote" TEXT,
    "provenance" TEXT NOT NULL,
    "scoredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Score_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_assetTicker_fkey" FOREIGN KEY ("assetTicker") REFERENCES "Asset" ("ticker") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_researchArtifactId_fkey" FOREIGN KEY ("researchArtifactId") REFERENCES "ResearchArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "outcome" TEXT,
    "outcomeNote" TEXT,
    "outcomeDate" DATETIME,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Decision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DecisionResearchLink" (
    "decisionId" TEXT NOT NULL,
    "researchArtifactId" TEXT NOT NULL,

    PRIMARY KEY ("decisionId", "researchArtifactId"),
    CONSTRAINT "DecisionResearchLink_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DecisionResearchLink_researchArtifactId_fkey" FOREIGN KEY ("researchArtifactId") REFERENCES "ResearchArtifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DecisionScoreLink" (
    "decisionId" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,

    PRIMARY KEY ("decisionId", "scoreId"),
    CONSTRAINT "DecisionScoreLink_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DecisionScoreLink_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetTicker" TEXT NOT NULL,
    "notes" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistEntry_assetTicker_fkey" FOREIGN KEY ("assetTicker") REFERENCES "Asset" ("ticker") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_name_key" ON "Framework"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_slug_key" ON "Framework"("slug");
