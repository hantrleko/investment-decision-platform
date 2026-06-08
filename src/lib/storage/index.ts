export type { IStorageProvider } from "./provider";
export { LocalStorageProvider } from "./local";

import { LocalStorageProvider } from "./local";

let _instance: LocalStorageProvider | undefined;

export function getStorage(): LocalStorageProvider {
  if (!_instance) {
    _instance = new LocalStorageProvider();
  }
  return _instance;
}
