import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { authRoutes } from './routes/auth.js';
import { flyioRoutes } from './routes/flyio.js';
import { agentsRoutes } from './routes/agents.js';
import { githubRoutes } from './routes/github.js';

const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: config.dashboardUrl,
    credentials: true,
  })
);
app.use('*', honoLogger());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', version: '2.3.0' });
});

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/flyio', flyioRoutes);
app.route('/api/agents', agentsRoutes);
app.route('/api/github', githubRoutes);

// Catch-all: redirect any non-API requests to dashboard (handles OAuth error redirects)
app.get('*', (c) => {
  const url = new URL(c.req.url);
  const dashboardUrl = new URL(config.dashboardUrl);
  dashboardUrl.search = url.search; // Preserve query params like ?error=state_mismatch
  return c.redirect(dashboardUrl.toString());
});

// Start server
const port = config.port;

logger.info({ port }, '247 Provisioning service starting...');

serve({
  fetch: app.fetch,
  port,
});

logger.info({ port, url: `http://localhost:${port}` }, 'Server started');
