import { buildServer } from '../lambdas/local-api/src/server';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? '3000');

const app = await buildServer();

await app.listen({ host, port });
console.log(`[local-api] listening on http://${host}:${port}`);

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});