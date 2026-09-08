import { buildApp } from "./app";

async function start(): Promise<void> {
  const app = buildApp();
  const port = Number(process.env.PORT || 3000);
  await app.listen({ host: "0.0.0.0", port: port });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
