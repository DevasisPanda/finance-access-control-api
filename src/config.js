const path = require('node:path');

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  PUBLIC_DIR: path.join(process.cwd(), 'public'),
};
