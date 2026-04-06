const fs = require('node:fs/promises');
const path = require('node:path');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'text/plain; charset=utf-8';
}

async function sendFile(res, filePath) {
  const content = await fs.readFile(filePath);
  res.writeHead(200, {
    'Content-Type': getContentType(filePath),
  });
  res.end(content);
}

async function tryServeStaticFile(req, res, url, publicDir) {
  if (req.method !== 'GET') {
    return false;
  }

  let relativePath = null;

  if (url.pathname === '/app' || url.pathname === '/app/') {
    relativePath = 'index.html';
  } else if (url.pathname === '/docs' || url.pathname === '/docs/') {
    relativePath = 'docs.html';
  } else if (url.pathname.startsWith('/assets/')) {
    relativePath = url.pathname.slice('/assets/'.length);
  }

  if (!relativePath) {
    return false;
  }

  const resolvedPath = path.resolve(publicDir, relativePath);
  const publicRoot = path.resolve(publicDir);
  if (resolvedPath !== publicRoot && !resolvedPath.startsWith(`${publicRoot}${path.sep}`)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }

  try {
    await sendFile(res, resolvedPath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

module.exports = {
  tryServeStaticFile,
};
