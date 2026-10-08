import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('aifotofilm_v20_production_bible.tsx');
function segment(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Source boundaries not found: ' + start);
  return source.slice(a, b).trimEnd();
}
function check(name, path, start, end) {
  const expected = segment(start, end);
  const file = read(path);
  const idx = file.indexOf('export ' + start);
  assert(idx >= 0, 'Module export not found: ' + name);
  const actual = file.slice(idx).replace(/^export const /gm, 'const ').trimEnd();
  assert.equal(actual, expected, name + ' differs from original V20 source');
  console.log('PASS: ' + name + ' exact extraction (' + expected.split('\n').length + ' lines)');
}
check('Gemini API', 'src/engine/gemini-api.ts',
  'const API_KEY =', "const J = 'Return JSON only.';");
check('Production presets', 'src/config/production-presets.ts',
  'const INITIAL_CHARACTERS = [', "const PFX = 'ai_fotofilm_v20_';");
const engine = read('src/engine/gemini-api.ts');
assert(engine.includes('const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image"'));
assert(engine.includes('const GEMINI_TEXT_MODEL = "gemini-3-flash-preview"'));
assert(engine.includes('Gemini gerçek görsel döndürmedi'));
console.log('PASS: Gemini model IDs and real-render rejection preserved');
