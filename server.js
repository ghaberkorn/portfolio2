const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.csv');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(SUBSCRIBERS_FILE)) {
    fs.writeFileSync(SUBSCRIBERS_FILE, 'email,tag,created_at\n', 'utf8');
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function handleSubscribe(req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
    if (body.length > 1e5) {
      req.socket.destroy();
    }
  });

  req.on('end', () => {
    const params = new URLSearchParams(body);
    if ((params.get('confirm') || '').trim()) {
      // Honeypot hit; pretend success.
      return sendJson(res, 200, { message: 'Thanks!' });
    }

    const email = (params.get('email') || '').trim().toLowerCase().replace(/[\r\n]+/g, '');
    const tag = (params.get('tag') || 'portfolio-site').trim().replace(/[\r\n]+/g, '').slice(0, 64);

    if (!email || !email.includes('@') || email.length > 254) {
      return sendJson(res, 400, { message: 'Please provide a valid email.' });
    }

    const line = `${email},${tag},${new Date().toISOString()}\n`;

    fs.appendFile(SUBSCRIBERS_FILE, line, err => {
      if (err) {
        console.error('Could not write subscriber:', err);
        return sendJson(res, 500, { message: 'Could not save right now.' });
      }
      sendJson(res, 200, { message: 'Added.' });
    });
  });
}

function serveStatic(req, res, pathname) {
  let safePath = path.normalize(pathname).replace(/^([.]{2}[\\/])+/g, '');
  if (safePath === '/') safePath = '/index.html';
  const filePath = path.join(ROOT, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mimeType });
    fs.createReadStream(filePath).pipe(res);
  });
}

ensureStorage();

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);

  if (req.method === 'POST' && pathname === '/api/subscribe') {
    return handleSubscribe(req, res);
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
  console.log(`Subscribers file: ${SUBSCRIBERS_FILE}`);
});
