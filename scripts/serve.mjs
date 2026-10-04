import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..', process.argv.includes('--dist') ? 'dist' : 'public');
const port = Number(process.env.MOVE_ATLAS_PORT || 5174);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const server = http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end();}
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) {res.writeHead(403);return res.end();}
    const info = await stat(file);
    if (!info.isFile()) {res.writeHead(404);return res.end();}
    res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.firebaseapp.com; frame-src https://*.firebaseapp.com https://accounts.google.com; frame-ancestors 'none'; base-uri 'self'"});
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch {res.writeHead(404);res.end('Not found');}
});
server.on('error', e => {console.error(e.message);process.exit(1);});
server.listen(port,'127.0.0.1',() => console.log(`Move Atlas is ready at http://127.0.0.1:${port}/`));
