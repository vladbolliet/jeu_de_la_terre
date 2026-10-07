import { loadContent } from '@jdlt/engine/load';
import { loadConfig } from './config.ts';
import { createGameServer } from './app.ts';

const config = loadConfig();
const { content, warnings } = loadContent(config.contentDir);
for (const w of warnings) console.warn(`content: ${w}`);

const server = createGameServer(config, content);
server.http.listen(config.port, () => {
  console.log(
    `server on http://localhost:${config.port} (host key: ${config.hostKey === 'dev' ? 'dev' : '***'})`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
