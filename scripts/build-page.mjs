import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = resolve(root, "src/page.ts");

function resolveImport(fromFile, spec) {
  const target = resolve(dirname(fromFile), spec);
  if (target.endsWith(".js")) {
    return `${target.slice(0, -3)}.ts`;
  }
  return `${target}.ts`;
}

function collect(file, seen, ordered) {
  if (seen.has(file)) {
    return;
  }
  seen.add(file);
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    collect(resolveImport(file, match[1]), seen, ordered);
  }
  ordered.push(file);
}

function transpile(file) {
  const source = readFileSync(file, "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    fileName: file,
  });
  return out.outputText
    .replace(/import\s+type\s+[\s\S]*?from\s+["'][^"']+["'];?/g, "")
    .replace(/import\s*\{[\s\S]*?\}\s*from\s+["'][^"']+["'];?/g, "")
    .replace(/import\s+[\w$]+\s+from\s+["'][^"']+["'];?/g, "")
    .replace(/^export\s+type\s+\{[\s\S]*?\};?/gm, "")
    .replace(/^export\s+/gm, "");
}

export function buildPage() {
  const ordered = [];
  collect(entry, new Set(), ordered);
  const js = `(function () {\n${ordered.map(transpile).join("\n")}\n})();\n`;
  if (/\bimport\s|\bexport\s/.test(js)) {
    throw new Error("bundle nadal ma import albo export");
  }
  const css = readFileSync(resolve(root, "src/app.css"), "utf8");
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rozliczenia</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
${js}
  </script>
</body>
</html>
`;
  writeFileSync(resolve(root, "index.html"), html);
  return html;
}

if (process.argv[1]?.endsWith("build-page.mjs")) {
  buildPage();
}
