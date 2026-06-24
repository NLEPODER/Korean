#!/usr/bin/env node
/**
 * Consolide la grammaire de tous les manuels en un référentiel global dédupliqué
 * (manuals/grammar.json) à clés stables, et réécrit le grammar[] de chaque manuel
 * en références { key, lesson }.
 *
 * IDEMPOTENT / ré-exécutable :
 *   - réutilise les clés déjà présentes dans grammar.json (aucune réattribution) ;
 *   - ingère les nouveaux volumes dont grammar[] contient encore des objets complets
 *     (pattern / meaning_en / form_en / examples) ;
 *   - préserve les manuels déjà migrés dont grammar[] est en références { key, lesson }.
 *
 * Ne touche jamais au vocabulaire (le bloc grammar[] est réécrit, le reste est préservé
 * tel quel — y compris les `gp` qui doivent référencer des clés de grammaire).
 *
 * Lancer après chaque nouvelle extraction :  node scripts/migrate-grammar.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'manuals');
const GRAMMAR_FILE = 'grammar.json';

const rank = { A1: 1, A2: 2, B1: 3, B2: 4 };
const norm = (p) => p.replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
// niveau CEFR déduit du meta.level du manuel (1A/1B → A1, 2A/2B → A2, …)
const cefr = (lvl) => {
  const s = String(lvl || '');
  if (s.startsWith('1')) return 'A1';
  if (s.startsWith('2')) return 'A2';
  if (s.startsWith('3')) return 'B1';
  if (s.startsWith('4')) return 'B2';
  return 'A1';
};

// liste des manuels = manifeste (grammar.json en est exclu par construction)
const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
const files = manifest.manuals.map((m) => m.file);

// repartir des points existants pour garder les clés stables
const groups = new Map(); // normPattern -> point
const byKey = new Map();   // key -> point
let order = 0;
try {
  const existing = JSON.parse(await readFile(join(dir, GRAMMAR_FILE), 'utf8'));
  for (const p of existing.points || []) {
    groups.set(norm(p.pattern), p);
    byKey.set(p.key, p);
    const n = parseInt(String(p.key).replace(/^g/, ''), 10);
    if (Number.isFinite(n)) order = Math.max(order, n);
  }
} catch { /* première exécution : pas de grammar.json */ }

const perManualRefs = {}; // file -> [{ key, lesson }]

for (const file of files) {
  const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
  const level = cefr(data.meta && data.meta.level);
  const refs = [];
  for (const g of data.grammar || []) {
    let pt;
    if (g.key) {
      // déjà une référence : on récupère le point correspondant
      pt = byKey.get(g.key);
      if (!pt) { console.warn(`⚠︎ ${file} référence une clé inconnue: ${g.key}`); continue; }
    } else {
      // objet complet : on consolide (création ou fusion)
      const n = norm(g.pattern);
      pt = groups.get(n);
      if (!pt) {
        pt = { key: 'g' + (++order), pattern: g.pattern, meaning: '', form: '', level, examples: [] };
        groups.set(n, pt);
        byKey.set(pt.key, pt);
      }
      if (g.pattern.length > pt.pattern.length) pt.pattern = g.pattern;
      if ((g.meaning_en || '').length > pt.meaning.length) pt.meaning = g.meaning_en || pt.meaning;
      if ((g.form_en || '').length > pt.form.length) pt.form = g.form_en || pt.form;
      for (const ex of g.examples || []) if (!pt.examples.includes(ex)) pt.examples.push(ex);
      if (rank[level] < rank[pt.level]) pt.level = level;
    }
    refs.push({ key: pt.key, lesson: g.lesson });
  }
  // dédup (key, lesson)
  const seen = new Set();
  perManualRefs[file] = refs.filter((r) => {
    const k = r.key + '#' + r.lesson;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// cap examples
for (const pt of groups.values()) pt.examples = pt.examples.slice(0, 6);

// écrit grammar.json (ordre = ordre d'apparition des clés g1, g2, …)
const points = [...byKey.values()].sort((a, b) =>
  parseInt(a.key.slice(1), 10) - parseInt(b.key.slice(1), 10));
await writeFile(join(dir, GRAMMAR_FILE),
  JSON.stringify({ generated: new Date().toISOString(), points }, null, 2) + '\n');

// réécrit le grammar[] de chaque manuel en références, sans toucher au reste
for (const file of files) {
  const path = join(dir, file);
  let text = await readFile(path, 'utf8');
  const idx = text.lastIndexOf('"grammar"');
  if (idx < 0) { console.warn(`⚠︎ ${file} : pas de clé "grammar", ignoré`); continue; }
  const prefix = text.slice(0, idx); // se termine par '...,\n  '
  const body = perManualRefs[file].map((r) => `    { "key": "${r.key}", "lesson": ${r.lesson} }`).join(',\n');
  text = prefix + '"grammar": [\n' + body + '\n  ]\n}\n';
  await writeFile(path, text);
}

console.log(`✅ ${GRAMMAR_FILE} — ${points.length} points uniques`);
console.log('Répartition niveaux:', points.reduce((a, p) => (a[p.level] = (a[p.level] || 0) + 1, a), {}));
for (const file of files) console.log(`   ${file}: ${perManualRefs[file].length} références`);
