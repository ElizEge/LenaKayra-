/** AiFotofilm V20.2: versioned metadata-only Production Memory. */
export const PRODUCTION_MEMORY_SCHEMA_VERSION = 1 as const;
export type ProductionMemory = {
  schemaVersion: typeof PRODUCTION_MEMORY_SCHEMA_VERSION;
  projectId: string;
  title: string;
  revision: number;
  updatedAt: string;
  characters: Record<string, { id: string; name: string; identityReferenceUrl?: string; identityLock?: string }>;
  scenes: Array<{ id: string; title: string; characterIds: string[]; prompt?: string; continuity?: Record<string, unknown> }>;
  assets: Array<{ id: string; sceneId?: string; mimeType?: string; remoteUrl?: string; checksum?: string }>;
};
export function validateProductionMemory(input: unknown): input is ProductionMemory {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const m = input as Record<string, unknown>;
  if (m.schemaVersion !== PRODUCTION_MEMORY_SCHEMA_VERSION ||
      typeof m.projectId !== 'string' || !m.projectId.trim() ||
      typeof m.title !== 'string' ||
      !Number.isSafeInteger(m.revision) || (m.revision as number) < 0 ||
      typeof m.updatedAt !== 'string' ||
      !m.characters || typeof m.characters !== 'object' || Array.isArray(m.characters) ||
      !Array.isArray(m.scenes) || !Array.isArray(m.assets)) return false;
  if (!Object.values(m.characters as Record<string, unknown>).every(c =>
      !!c && typeof c === 'object' && typeof (c as any).id === 'string' && typeof (c as any).name === 'string')) return false;
  if (!(m.scenes as unknown[]).every(s => !!s && typeof s === 'object' &&
      typeof (s as any).id === 'string' && typeof (s as any).title === 'string' &&
      Array.isArray((s as any).characterIds) &&
      (s as any).characterIds.every((id: unknown) => typeof id === 'string'))) return false;
  return (m.assets as unknown[]).every(a => !!a && typeof a === 'object' &&
      typeof (a as any).id === 'string' &&
      !(typeof (a as any).remoteUrl === 'string' && (a as any).remoteUrl.startsWith('data:')));
}
export function createEmptyProductionMemory(projectId: string, title = 'Yeni Proje'): ProductionMemory {
  if (!projectId.trim()) throw new Error('Proje kimliği boş olamaz.');
  return { schemaVersion: 1, projectId, title, revision: 0,
    updatedAt: new Date().toISOString(), characters: {}, scenes: [], assets: [] };
}
