import cors from 'cors';
import express from 'express';
import aiAssistantRoutes from './routes/aiAssistantRoutes.js';
import authRoutes from './routes/authRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import impactAnalysisRoutes from './routes/impactAnalysisRoutes.js';
import relationshipRoutes from './routes/relationshipRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import testCaseRoutes from './routes/testCaseRoutes.js';
import traceabilityRoutes from './routes/traceabilityRoutes.js';
import { requireDatabase } from './middleware/requireDatabase.js';
import { requireAuth } from './middleware/requireAuth.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { formatRequirementId } from './utils/requirementIds.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use((_request, response, next) => {
  const sendJson = response.json.bind(response);
  response.json = (body) => sendJson(formatRequirementIds(body));
  next();
});
app.use('/api/health', healthRoutes);
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/ai-assistant', requireDatabase, requireAuth, aiAssistantRoutes);
app.use('/api/requirements', requireDatabase, requireAuth, requirementRoutes);
app.use('/api/traceability', requireDatabase, requireAuth, traceabilityRoutes);
app.use('/api/impact-analyses', requireDatabase, requireAuth, impactAnalysisRoutes);
app.use('/api/relationships', requireDatabase, requireAuth, relationshipRoutes);
app.use('/api/test-cases', requireDatabase, requireAuth, testCaseRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

function formatRequirementIds(value) {
  if (typeof value === 'string') return formatRequirementId(value);
  if (Array.isArray(value)) return value.map(formatRequirementIds);
  if (value instanceof Date || Buffer.isBuffer(value) || value?._bsontype) return value;
  if (value && typeof value.toJSON === 'function') return formatRequirementIds(value.toJSON());
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, formatRequirementIds(nested)]));
  }
  return value;
}
