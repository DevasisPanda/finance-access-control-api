const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { DEMO_PRODUCTS } = require('../src/product-store');

async function withTestServer(run, options = {}) {
  const app = createApp(options);
  await app.start(0);
  const baseUrl = `http://127.0.0.1:${app.port}`;

  try {
    await run({ baseUrl });
  } finally {
    await app.close();
  }
}

async function request(baseUrl, pathname, options = {}) {
  const headers = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test('homepage serves the app shell', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Miravi Mart/);
    assert.match(html, /Add Product/);
    assert.match(html, /Product Listing/);
  });
});

test('GET /products returns the seeded products', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await request(baseUrl, '/products');

    assert.equal(response.status, 200);
    assert.equal(response.body.length, DEMO_PRODUCTS.length);
    assert.deepEqual(
      response.body.map((product) => product.name),
      DEMO_PRODUCTS.map((product) => product.name)
    );
  });
});

test('POST /products creates a product and rejects invalid payloads', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const invalidResponse = await request(baseUrl, '/products', {
      method: 'POST',
      body: {
        name: '',
        price: 'free',
        imageUrl: '',
      },
    });

    assert.equal(invalidResponse.status, 400);
    assert.equal(invalidResponse.body.error, 'Name is required.');

    const createResponse = await request(baseUrl, '/products', {
      method: 'POST',
      body: {
        name: 'Canvas Weekender Bag',
        price: 65.5,
        imageUrl: 'https://picsum.photos/seed/weekender/640/480',
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.name, 'Canvas Weekender Bag');
    assert.match(createResponse.body.id, /.+/);

    const listResponse = await request(baseUrl, '/products');
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.length, DEMO_PRODUCTS.length + 1);
    assert.equal(listResponse.body[0].name, 'Canvas Weekender Bag');
  });
});

test('PUT /products updates a product and returns 404 for unknown ids', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const updateResponse = await request(baseUrl, '/products/demo-desk-lamp', {
      method: 'PUT',
      body: {
        name: 'Nordic Desk Lamp XL',
        price: 59.99,
        imageUrl: 'https://picsum.photos/seed/desk-lamp-xl/640/480',
      },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.name, 'Nordic Desk Lamp XL');
    assert.equal(updateResponse.body.price, 59.99);

    const missingResponse = await request(baseUrl, '/products/does-not-exist', {
      method: 'PUT',
      body: {
        name: 'Missing Product',
        price: 24,
        imageUrl: 'https://picsum.photos/seed/missing/640/480',
      },
    });

    assert.equal(missingResponse.status, 404);
    assert.equal(missingResponse.body.error, 'Product not found.');
  });
});

test('DELETE /products removes a product and the next list reflects the change', async () => {
  await withTestServer(async ({ baseUrl }) => {
    const deleteResponse = await request(baseUrl, '/products/demo-backpack', {
      method: 'DELETE',
    });

    assert.equal(deleteResponse.status, 204);
    assert.equal(deleteResponse.body, null);

    const listResponse = await request(baseUrl, '/products');
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.length, DEMO_PRODUCTS.length - 1);
    assert.ok(
      listResponse.body.every((product) => product.id !== 'demo-backpack')
    );
  });
});
