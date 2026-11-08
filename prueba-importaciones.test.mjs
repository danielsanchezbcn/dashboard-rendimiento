// Detecta nombres exportados por otros módulos de la aplicación que se usan en un archivo sin importarlos ni definirlos (error que solo salta al ejecutar).
import fs from 'node:fs';
const files = fs.readdirSync('.').filter((f) => f.endsWith('.js') && !/^(libs|libs-fuente)\.js$/.test(f));
const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/`(?:[^`\\]|\\.)*`/gs, (m) => m)]));
const exportsOf = {};
for (const f of files) for (const m of src[f].matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) (exportsOf[m[1]] ??= []).push(f);
const problems = [];
for (const f of files) {
  const s = src[f];
  const imported = new Set([...s.matchAll(/import\s*\{([^}]*)\}\s*from/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean)));
  for (const [name, owners] of Object.entries(exportsOf)) {
    if (name.length < 5 || owners.includes(f) || imported.has(name)) continue;
    const declared = new RegExp(`\\b(?:const|let|var|function|class)\\s+${name.replace(/\$/g, '\\$')}\\b|[\\(,]\\s*${name.replace(/\$/g, '\\$')}\\s*[,)=]|\\{[^}]*\\b${name.replace(/\$/g, '\\$')}\\b[^}]*\\}\\s*=`).test(s);
    if (declared) continue;
    if (new RegExp(`(?<![\\w$.'"#/-])${name.replace(/\$/g, '\\$')}\\s*\\(`).test(s) || new RegExp(`<\\$\\{${name}\\}`).test(s)) problems.push(`${f} usa ${name} (de ${owners.join(', ')}) sin importarlo`);
  }
}
console.log((problems.length ? 'FAIL ' : 'OK   ') + 'ningún módulo usa funciones exportadas de otro sin importarlas' + (problems.length ? ': ' + problems.join(' ; ') : ''));
process.exit(problems.length ? 1 : 0);
