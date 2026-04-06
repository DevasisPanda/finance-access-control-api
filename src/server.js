const { PORT } = require('./config');
const { createApp } = require('./app');

async function bootstrap() {
  const app = createApp();
  await app.start(PORT);

  console.log(`Finance Records Service running on http://localhost:${app.port}`);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
