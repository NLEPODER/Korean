#!/usr/bin/env node
/**
 * Génère manuals/manifest.json à partir des fichiers JSON présents dans manuals/.
 * Lancé en local (`npm run manifest`) et par la GitHub Action avant le déploiement.
 * → Déposer un nouveau JSON dans manuals/ suffit : le manifeste se régénère tout seul.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'manuals');
const MANIFEST = 'manifest.json';

const files = (await readdir(dir))
  .filter(f => f.endsWith('.json') && f !== MANIFEST && f !== 'grammar.json')
  .sort();

const manuals = [];
for (const file of files) {
  let obj;
  try {
    obj = JSON.parse(await readFile(join(dir, file), 'utf8'));
  } catch (e) {
    console.warn(`⚠️  ${file} ignoré (JSON invalide): ${e.message}`);
    continue;
  }
  const lessons = Array.isArray(obj.lessons) ? obj.lessons : [];
  if (!lessons.length) {
    console.warn(`⚠️  ${file} ignoré (pas de "lessons").`);
    continue;
  }
  const level = obj.meta?.level ? String(obj.meta.level) : file.replace(/\.json$/i, '');
  manuals.push({
    file,
    level,
    name: obj.meta?.name ? String(obj.meta.name) : level,
    source: obj.meta?.source || level,
    lessons: lessons.length,
    vocab: lessons.reduce((s, l) => s + (l.vocabulary?.length || 0), 0),
    grammar: Array.isArray(obj.grammar) ? obj.grammar.length : 0,
  });
}

const manifest = { generated: new Date().toISOString(), manuals };
await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
console.log(`✅ manuals/${MANIFEST} — ${manuals.length} manuel(s): ${manuals.map(m => m.level).join(', ')}`);
