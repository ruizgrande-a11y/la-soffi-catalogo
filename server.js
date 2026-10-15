const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { URL } = require('url');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lasoffi2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'la-soffi-cambia-este-secreto-en-produccion';

function extractTarGz(archivePath, destinationRoot) {
  const tar = zlib.gunzipSync(fs.readFileSync(archivePath));
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeRaw = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeRaw || '0', 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    offset += 512;

    if (name && (type === '0' || type === '\0')) {
      const destination = path.normalize(path.join(destinationRoot, name));
      if (!destination.startsWith(destinationRoot)) {
        throw new Error('Ruta inválida dentro del archivo de imágenes');
      }
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, tar.subarray(offset, offset + size));
    }

    offset += Math.ceil(size / 512) * 512;
  }
}

function ensureProductImages() {
  const marker = path.join(PUBLIC_DIR, 'assets', 'products', 'p4-tl.jpg');
  const archive = path.join(ROOT, 'product-images.tar.gz');
  const destinationRoot = path.join(PUBLIC_DIR, 'assets');

  if (fs.existsSync(marker) || !fs.existsSync(archive)) return;

  fs.mkdirSync(destinationRoot, { recursive: true });
  extractTarGz(archive, destinationRoot);
  console.log('Imágenes iniciales de productos de La Soffi preparadas.');
}

ensureProductImages();
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function safeId(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || crypto.randomUUID();
}

function tokenFor(user) {
  return crypto.createHmac('sha256', SESSION_SECRET)
    .update(`${user}:${ADMIN_PASSWORD}`)
    .digest('hex');
}

function isAuthed(req) {
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${tokenFor(ADMIN_USER)}`;
}

function collect(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(PUBLIC_DIR)) {
    return json(res, 403, { error: 'No autorizado' });
  }

  fs.stat(normalized, (err, stat) => {
    if (err || !stat.isFile()) {
      const productsSegment = `${path.sep}assets${path.sep}products${path.sep}`;
      if (normalized.includes(productsSegment)) {
        return serveFile(res, path.join(PUBLIC_DIR, 'assets', 'categories', 'tortas.jpg'));
      }
      return json(res, 404, { error: 'No encontrado' });
    }

    const ext = path.extname(normalized).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });
    fs.createReadStream(normalized).pipe(res);
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'La Soffi catálogo' });
  }

  if (req.method === 'GET' && url.pathname === '/api/products') {
    return json(res, 200, readJson(PRODUCTS_FILE, []).filter(product => product.active !== false));
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/products') {
    if (!isAuthed(req)) return json(res, 401, { error: 'Sesión no válida' });
    return json(res, 200, readJson(PRODUCTS_FILE, []));
  }

  if (req.method === 'GET' && url.pathname === '/api/settings') {
    return json(res, 200, readJson(SETTINGS_FILE, {}));
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    try {
      const body = JSON.parse((await collect(req)).toString('utf8') || '{}');
      if (body.user === ADMIN_USER && body.password === ADMIN_PASSWORD) {
        return json(res, 200, { token: tokenFor(ADMIN_USER), user: ADMIN_USER });
      }
      return json(res, 401, { error: 'Usuario o contraseña incorrectos' });
    } catch {
      return json(res, 400, { error: 'Solicitud inválida' });
    }
  }

  if (url.pathname === '/api/settings' && req.method === 'PUT') {
    if (!isAuthed(req)) return json(res, 401, { error: 'No autorizado' });
    try {
      const body = JSON.parse((await collect(req)).toString('utf8') || '{}');
      const current = readJson(SETTINGS_FILE, {});
      const next = { ...current, ...body };
      writeJson(SETTINGS_FILE, next);
      return json(res, 200, next);
    } catch {
      return json(res, 400, { error: 'Datos inválidos' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/upload') {
    if (!isAuthed(req)) return json(res, 401, { error: 'No autorizado' });
    try {
      const rawName = path.basename(url.searchParams.get('name') || 'imagen.jpg');
      const ext = path.extname(rawName).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        return json(res, 400, { error: 'Formato no permitido' });
      }
      const data = await collect(req, 8 * 1024 * 1024);
      const filename = `${Date.now()}-${safeId(path.basename(rawName, ext))}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), data);
      return json(res, 201, { url: `/uploads/${filename}` });
    } catch (error) {
      return json(res, 400, { error: error.message || 'No se pudo subir la imagen' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/products') {
    if (!isAuthed(req)) return json(res, 401, { error: 'No autorizado' });
    try {
      const body = JSON.parse((await collect(req)).toString('utf8') || '{}');
      if (!body.name || !body.category) {
        return json(res, 400, { error: 'Nombre y categoría son obligatorios' });
      }

      const products = readJson(PRODUCTS_FILE, []);
      let id = safeId(body.id || body.name);
      let suffix = 2;
      while (products.some(product => product.id === id)) {
        id = `${safeId(body.name)}-${suffix++}`;
      }

      const product = {
        id,
        name: String(body.name).trim(),
        category: String(body.category).trim(),
        price: Number(body.price || 0),
        priceLabel: String(body.priceLabel || '').trim(),
        description: String(body.description || '').trim(),
        image: String(body.image || '/assets/categories/tortas.jpg'),
        featured: Boolean(body.featured),
        active: body.active !== false
      };

      products.unshift(product);
      writeJson(PRODUCTS_FILE, products);
      return json(res, 201, product);
    } catch {
      return json(res, 400, { error: 'Datos inválidos' });
    }
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);

  if (productMatch && req.method === 'PUT') {
    if (!isAuthed(req)) return json(res, 401, { error: 'No autorizado' });
    try {
      const id = decodeURIComponent(productMatch[1]);
      const body = JSON.parse((await collect(req)).toString('utf8') || '{}');
      const products = readJson(PRODUCTS_FILE, []);
      const index = products.findIndex(product => product.id === id);
      if (index < 0) return json(res, 404, { error: 'Producto no encontrado' });

      products[index] = {
        ...products[index],
        ...body,
        id,
        price: Number(body.price ?? products[index].price),
        featured: Boolean(body.featured ?? products[index].featured),
        active: body.active !== false
      };
      writeJson(PRODUCTS_FILE, products);
      return json(res, 200, products[index]);
    } catch {
      return json(res, 400, { error: 'Datos inválidos' });
    }
  }

  if (productMatch && req.method === 'DELETE') {
    if (!isAuthed(req)) return json(res, 401, { error: 'No autorizado' });
    const id = decodeURIComponent(productMatch[1]);
    const products = readJson(PRODUCTS_FILE, []);
    const next = products.filter(product => product.id !== id);
    if (next.length === products.length) {
      return json(res, 404, { error: 'Producto no encontrado' });
    }
    writeJson(PRODUCTS_FILE, next);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'API no encontrada' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (url.pathname === '/') return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
    if (url.pathname === '/catalogo' || url.pathname === '/catalogo/') {
      return serveFile(res, path.join(PUBLIC_DIR, 'catalogo.html'));
    }
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    }
    return serveFile(res, path.join(PUBLIC_DIR, decodeURIComponent(url.pathname)));
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Error interno del servidor' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`La Soffi disponible en http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('⚠️  Demo admin: admin / lasoffi2026. Configura ADMIN_PASSWORD en producción.');
  }
});
