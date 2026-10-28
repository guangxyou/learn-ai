import { readFile, writeFile } from 'node:fs/promises';
const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const [html, css, js] = await Promise.all(['page.template.html', 'style.css', 'app.js'].map(read));
const output = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script defer src="app.js"></script>', () => `<script>\n${js}\n</script>`);
await writeFile(new URL('index.html', import.meta.url), output);
console.log('Built standalone index.html.');
