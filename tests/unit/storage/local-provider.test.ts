import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalStorageProvider } from "@/lib/storage/local";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

describe("LocalStorageProvider", () => {
  let provider: LocalStorageProvider;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "eugene-test-"));
    provider = new LocalStorageProvider(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("saves a file and returns relative path", async () => {
    const buffer = Buffer.from("hello world");
    const relPath = await provider.save("attachments/test", "file.txt", buffer);
    expect(relPath).toBe("attachments/test/file.txt");

    const fullPath = path.join(tempDir, relPath);
    const content = await fs.readFile(fullPath, "utf-8");
    expect(content).toBe("hello world");
  });

  it("reads a saved file", async () => {
    const buffer = Buffer.from("test content");
    await provider.save("data", "read-test.txt", buffer);

    const read = await provider.read("data/read-test.txt");
    expect(read.toString()).toBe("test content");
  });

  it("deletes a file", async () => {
    const buffer = Buffer.from("to delete");
    await provider.save("tmp", "del.txt", buffer);

    await provider.delete("tmp/del.txt");
    const exists = await provider.exists("tmp/del.txt");
    expect(exists).toBe(false);
  });

  it("delete does not throw on missing file", async () => {
    await expect(provider.delete("nonexistent.txt")).resolves.not.toThrow();
  });

  it("exists returns false for missing file", async () => {
    const exists = await provider.exists("no-such-file.txt");
    expect(exists).toBe(false);
  });

  it("exists returns true for saved file", async () => {
    const buffer = Buffer.from("exists test");
    await provider.save("check", "exists.txt", buffer);

    const exists = await provider.exists("check/exists.txt");
    expect(exists).toBe(true);
  });

  it("creates intermediate directories when saving", async () => {
    const buffer = Buffer.from("nested");
    const relPath = await provider.save("a/b/c/d", "deep.txt", buffer);
    expect(relPath).toBe("a/b/c/d/deep.txt");

    const read = await provider.read(relPath);
    expect(read.toString()).toBe("nested");
  });
});
