// Zips dist/extension into web/public so the dashboard can serve it for download.
import archiver from 'archiver';
import { createWriteStream, mkdirSync } from 'node:fs';

mkdirSync('web/public', { recursive: true });
const out = createWriteStream('web/public/formpilot-extension.zip');
const zip = archiver('zip', { zlib: { level: 9 } });
zip.pipe(out);
zip.directory('dist/extension/', 'formpilot-extension');
await zip.finalize();
await new Promise((r) => out.on('close', r));
console.log(`Packaged extension: web/public/formpilot-extension.zip (${zip.pointer()} bytes)`);
