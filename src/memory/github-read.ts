import { ProductionMemory, validateProductionMemory } from './schema';

/**
 * Public, read-only GitHub memory transport.
 * This is NOT an authenticated sync implementation.
 * Never put GitHub PATs or Gemini API keys into repository files.
 */
export type RemoteMemorySnapshot = {
  memory: ProductionMemory;
  sha: string;
  source: string;
};
export type MemoryLoadResult =
  | { ok: true; snapshot: RemoteMemorySnapshot }
  | { ok: false; error: string; status?: number };

const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;
export function projectMemoryPath(projectId: string): string {
  if (!SAFE_SEGMENT.test(projectId)) throw new Error('Geçersiz proje kimliği.');
  return 'production-memory/projects/' + projectId + '/memory.json';
}
export async function loadPublicGithubMemory(
  owner: string,
  repo: string,
  projectId: string,
  ref = 'main',
  signal?: AbortSignal
): Promise<MemoryLoadResult> {
  if (![owner, repo, ref].every(s => /^[\w.\/-]+$/.test(s)) || owner.includes('/') || repo.includes('/')) {
    return { ok: false, error: 'Geçersiz GitHub depo veya dal adı.' };
  }
  let path: string;
  try { path = projectMemoryPath(projectId); }
  catch (e) { return { ok: false, error: String(e) }; }
  const url = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' +
    encodeURIComponent(repo) + '/contents/' + path + '?ref=' + encodeURIComponent(ref);
  try {
    const response = await fetch(url, {
      method: 'GET', signal, cache: 'no-store',
      headers: { Accept: 'application/vnd.github.raw+json' }
    });
    if (!response.ok) return { ok: false, status: response.status,
      error: response.status === 404 ? 'Uzak proje hafızası henüz oluşturulmamış.' :
        'GitHub hafıza okuma hatası (HTTP ' + response.status + ').' };
    const sha = response.headers.get('etag') || '';
    const body: unknown = await response.json();
    if (!validateProductionMemory(body)) return { ok: false, error: 'Uzak hafıza şeması geçersiz.' };
    if (body.projectId !== projectId) return { ok: false, error: 'Uzak hafıza proje kimliği uyuşmuyor.' };
    return { ok: true, snapshot: { memory: body, sha, source: url } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'GitHub erişimi başarısız.' };
  }
}
