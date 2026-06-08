-- FTS5 virtual table for research artifact full-text search
-- Spec reference: §8.6 Full-Text Search
-- Note: Prisma SQLite tables use PascalCase model names (e.g., "ResearchArtifact")

CREATE VIRTUAL TABLE IF NOT EXISTS research_search USING fts5(
  title,
  content,
  tags,
  content="ResearchArtifact",
  content_rowid=rowid
);

CREATE TRIGGER IF NOT EXISTS research_ai AFTER INSERT ON "ResearchArtifact" BEGIN
  INSERT INTO research_search(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS research_ad AFTER DELETE ON "ResearchArtifact" BEGIN
  INSERT INTO research_search(research_search, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS research_au AFTER UPDATE ON "ResearchArtifact" BEGIN
  INSERT INTO research_search(research_search, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
  INSERT INTO research_search(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;
