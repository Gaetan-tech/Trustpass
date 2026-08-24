import { Router } from 'express';
import { live, ready, health, metrics } from './health.controller.js';

// Sondes montées sous /api/v1 (voir manifeste k8s : /api/v1/live, /api/v1/ready).
export const healthRoutes = Router();

healthRoutes.get('/live', live);
healthRoutes.get('/ready', ready);
healthRoutes.get('/health', health);
healthRoutes.get('/metrics', metrics);
