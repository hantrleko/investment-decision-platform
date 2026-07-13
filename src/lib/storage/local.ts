import { promises as fs } from "fs";
import path from "path";
import { IStorageProvider } from "./provider";

export class LocalStorageProvider implements IStorageProvider {
  private rootPath: string;

  constructor(rootPath?: string) {
    this.rootPath = rootPath || process.env.STORAGE_PATH || "./storage";
  }

  private resolve(relPath: string): string {
    const normalized = path.normalize(relPath);
    // Reject any path that tries to escape the storage root.
    if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
      throw new Error(`Invalid storage path: "${relPath}"`);
    }
    return path.resolve(this.rootPath, normalized);
  }

  async save(directory: string, fileName: string, buffer: Buffer): Promise<string> {
    const dirPath = this.resolve(directory);
    await fs.mkdir(dirPath, { recursive: true });
    const fullPath = path.join(dirPath, fileName);
    await fs.writeFile(fullPath, buffer);
    return path.relative(this.rootPath, fullPath).replace(/\\/g, "/");
  }

  async read(relPath: string): Promise<Buffer> {
    const fullPath = this.resolve(relPath);
    return fs.readFile(fullPath);
  }

  async delete(relPath: string): Promise<void> {
    const fullPath = this.resolve(relPath);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
  }

  async exists(relPath: string): Promise<boolean> {
    const fullPath = this.resolve(relPath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
