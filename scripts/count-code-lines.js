const fs = require('fs');
const path = require('path');

const applications = [
  ['API', 'apps/api'],
  ['ADM', 'apps/admin'],
  ['Client', 'apps/client'],
  ['Desktop', 'apps/desktop'],
];

// Diretórios de dependências, saída de build, metadados ou código gerado.
const ignoredDirectories = new Set([
  '.git', '.expo', '.turbo', 'build', 'coverage', 'dist', 'drizzle', 'generated', 'node_modules', 'out',
]);
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content === '' ? 0 : content.split(/\r?\n/).filter(line => line.trim() !== '').length;
}

function countApplication(rootPath) {
  let files = 0;
  let lines = 0;

  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(path.join(directory, entry.name));
        continue;
      }
      if (!entry.isFile() || !codeExtensions.has(path.extname(entry.name))) continue;
      files += 1;
      lines += countLines(path.join(directory, entry.name));
    }
  };

  visit(rootPath);
  return { files, lines };
}

const results = applications.map(([name, relativePath]) => ({ name, ...countApplication(path.join(__dirname, '..', relativePath)) }));
const total = results.reduce((sum, result) => ({ files: sum.files + result.files, lines: sum.lines + result.lines }), { files: 0, lines: 0 });

console.table([...results, { name: 'Total', ...total }].map(result => ({
  Aplicação: result.name,
  Arquivos: result.files,
  'Linhas de código': result.lines,
})));
