import { createServer } from './server.js';
import { registerWithDashboard, startHeartbeat } from './register.js';
import config from '../config.json' with { type: 'json' };

const PORT = config.agent?.port || 4678;

async function main() {
  console.log(`Starting Claude Remote Agent for ${config.machine.name}...`);

  const server = createServer();

  server.listen(PORT, () => {
    console.log(`Agent running on http://localhost:${PORT}`);
    console.log(`Agent URL: ${config.agent?.url || `localhost:${PORT}`}`);

    // Register with dashboard and start heartbeat
    registerWithDashboard();
    startHeartbeat();
  });
}

main().catch(console.error);
