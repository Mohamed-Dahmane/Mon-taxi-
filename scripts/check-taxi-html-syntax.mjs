// Vérifie les scripts de la page et du module hôtel embarqué avant publication.
// Usage: node scripts/check-taxi-html-syntax.mjs
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
let checked = 0;
for (const [index, match] of scripts.entries()) {
  if (!match[1].trim()) continue;
  try { new vm.Script(match[1], {filename: 'index.html:script-' + index}); checked++; }
  catch (error) { console.error('Script invalide :', index, error); process.exitCode = 1; }
}
// Le module hôtel est injecté dans srcdoc sous forme d'une chaîne JS.
// Son HTML est compilé par le navigateur; ce contrôle couvre au minimum
// la syntaxe du script externe qui le construit.
if (!checked) { console.error('Aucun script contrôlé'); process.exitCode = 1; }
if (!process.exitCode) console.log(checked + ' scripts JavaScript valides');
