import { ProductionMemory, validateProductionMemory } from './schema';

/** Local cache is best-effort only: GitHub sync will be the durable store. */
const KEY_PREFIX = 'aifotofilm_memory_v1_';
export type CacheResult = { ok: true } | { ok: false; error: string };
export function readMemoryCache(projectId: string): ProductionMemory | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + projectId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validateProductionMemory(parsed) && parsed.projectId === projectId ? parsed : null;
  } catch { return null; }
}
export function writeMemoryCache(memory: ProductionMemory): CacheResult {
  if (!validateProductionMemory(memory)) return { ok: false, error: 'Geçersiz hafıza şeması.' };
  try {
    localStorage.setItem(KEY_PREFIX + memory.projectId, JSON.stringify(memory));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Yerel kayıt başarısız.' };
  }
}
export function exportMemoryJson(memory: ProductionMemory): string {
  if (!validateProductionMemory(memory)) throw new Error('Geçersiz hafıza şeması.');
  return JSON.stringify(memory, null, 2);
}
export function importMemoryJson(json: string): ProductionMemory {
  const parsed: unknown = JSON.parse(json);
  if (!validateProductionMemory(parsed)) throw new Error('Uyumsuz Production Memory dosyası.');
  return parsed;
}
