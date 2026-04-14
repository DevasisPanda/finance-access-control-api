const http = require('node:http');
const express = require('express');
const { PORT, PUBLIC_DIR } = require('./config');
const { createProductStore } = require('./product-store');

function validateProductPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      error: 'Request body must be a JSON object.',
    };
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const imageUrl =
    typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';
  const price = Number(payload.price);

  if (!name) {
    return {
      error: 'Name is required.',
    };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return {
      error: 'Price must be a positive number.',
    };
  }

  if (!imageUrl) {
    return {
      error: 'Image URL is required.',
    };
  }

  return {
    value: {
      name,
      price,
      imageUrl,
    },
  };
}

function createApp(options = {}) {
  const productStore =
    options.productStore || createProductStore(options.initialProducts);
  const app = express();
  const server = http.createServer(app);

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/products', (_req, res) => {
    res.status(200).json(productStore.list());
  });

  app.post('/products', (req, res) => {
    const validation = validateProductPayload(req.body);
    if (validation.error) {
      res.status(400).json({ error: validation.error });
      return;
    }

    res.status(201).json(productStore.create(validation.value));
  });

  app.put('/products/:id', (req, res) => {
    const validation = validateProductPayload(req.body);
    if (validation.error) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const updatedProduct = productStore.update(req.params.id, validation.value);
    if (!updatedProduct) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    res.status(200).json(updatedProduct);
  });

  app.delete('/products/:id', (req, res) => {
    const removed = productStore.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    res.sendStatus(204);
  });

  app.use(express.static(PUBLIC_DIR));

  app.get('/', (_req, res) => {
    res.redirect('/index.html');
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return {
    app,
    server,
    port: null,
    async start(port = PORT) {
      await new Promise((resolve) => server.listen(port, resolve));
      this.port = server.address().port;
      return { port: this.port };
    },
    async close() {
      if (!server.listening) {
        return;
      }

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

module.exports = {
  createApp,
  validateProductPayload,
};
