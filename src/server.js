const { PORT } = require('./config');
const { createApp } = require('./app');

const appInstance = createApp();

async function bootstrap() {
  await appInstance.start(PORT);

  console.log(`Miravi Mart running on http://localhost:${appInstance.port}`);

  const shutdown = async () => {
    await appInstance.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = appInstance.app;
