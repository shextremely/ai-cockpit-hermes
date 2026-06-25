import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { bffAuth } from './middleware/auth.js';
import { HermesError } from './hermes.js';
import { healthRouter } from './routes/health.js';
import { capabilitiesRouter } from './routes/capabilities.js';
import { runsRouter } from './routes/runs.js';
import { dashboardRouter } from './routes/dashboard.js';
import { jobsRouter } from './routes/jobs.js';
import { knowledgeRouter } from './routes/knowledge.js';

const app = express();

if (config.bff.allowOrigin) {
  app.use(
    cors({
      origin: config.bff.allowOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
}

app.use(express.json({ limit: '2mb' }));

// API 子路由统一挂在 /api,并经可选 BFF 鉴权
const api = express.Router();
api.use(bffAuth);
api.use(healthRouter);
api.use(capabilitiesRouter);
api.use(runsRouter);
api.use(dashboardRouter);
api.use(jobsRouter);
api.use(knowledgeRouter);
app.use('/api', api);

// 生产:托管前端构建产物(同源部署,免 CORS)
if (fs.existsSync(config.webDist)) {
  app.use(express.static(config.webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(config.webDist, 'index.html'));
  });
}

// 统一错误处理
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err instanceof HermesError ? err.status || 502 : 500;
  const message = err instanceof Error ? err.message : String(err);
  res.status(status).json({ error: 'hermes_error', message });
});

app.listen(config.bff.port, () => {
  console.log(`[BFF] listening on http://localhost:${config.bff.port}`);
  console.log(`[BFF] proxying Hermes at ${config.hermes.baseUrl}`);
  if (!fs.existsSync(config.webDist)) {
    console.log('[BFF] web/dist 未构建,仅提供 /api(开发期请用 Vite 起前端)');
  }
});
