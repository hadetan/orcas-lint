import { join } from 'node:path';
import { existsSync } from 'fs';
import { AsyncLocalStorage } from 'async_hooks';
export const y = join('/a', 'b');
export const z = existsSync;
export const als = AsyncLocalStorage;
