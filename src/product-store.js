const { randomUUID } = require('node:crypto');

const DEMO_PRODUCTS = [
  {
    id: 'demo-desk-lamp',
    name: 'Nordic Desk Lamp',
    price: 49.99,
    imageUrl: 'https://picsum.photos/seed/desk-lamp/640/480',
  },
  {
    id: 'demo-headphones',
    name: 'Studio Wireless Headphones',
    price: 129.0,
    imageUrl: 'https://picsum.photos/seed/headphones/640/480',
  },
  {
    id: 'demo-backpack',
    name: 'Everyday Travel Backpack',
    price: 79.5,
    imageUrl: 'https://picsum.photos/seed/backpack/640/480',
  },
];

function cloneProduct(product) {
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    imageUrl: product.imageUrl,
  };
}

function cloneProducts(products) {
  return products.map(cloneProduct);
}

function createProductStore(initialProducts = DEMO_PRODUCTS) {
  let products = cloneProducts(initialProducts);

  return {
    list() {
      return cloneProducts(products);
    },
    create(input) {
      const product = {
        id: randomUUID(),
        name: input.name,
        price: Number(input.price),
        imageUrl: input.imageUrl,
      };

      products = [product, ...products];
      return cloneProduct(product);
    },
    update(productId, input) {
      const productIndex = products.findIndex((product) => product.id === productId);
      if (productIndex === -1) {
        return null;
      }

      const updatedProduct = {
        ...products[productIndex],
        name: input.name,
        price: Number(input.price),
        imageUrl: input.imageUrl,
      };

      products = products.map((product, index) =>
        index === productIndex ? updatedProduct : product
      );

      return cloneProduct(updatedProduct);
    },
    remove(productId) {
      const nextProducts = products.filter((product) => product.id !== productId);
      if (nextProducts.length === products.length) {
        return false;
      }

      products = nextProducts;
      return true;
    },
  };
}

module.exports = {
  DEMO_PRODUCTS,
  createProductStore,
};
