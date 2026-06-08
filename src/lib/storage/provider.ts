export interface IStorageProvider {
  save(directory: string, fileName: string, buffer: Buffer): Promise<string>;
  read(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
