import { Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes.js';
import { eventsRoutes } from './modules/events/events.routes.js';
import { ticketsRoutes } from './modules/tickets/tickets.routes.js';
import { listingsRoutes } from './modules/listings/listings.routes.js';
import { ordersRoutes } from './modules/orders/orders.routes.js';
import { webhooksRoutes } from './modules/webhooks/webhooks.routes.js';
import { organizerRoutes } from './modules/organizer/organizer.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';

// Routeur applicatif monté sous /api/v1 (voir API_CONTRACT.md).
export const apiRouter = Router();

// Sondes de supervision : /api/v1/live, /ready, /health, /metrics (BLOC 4, §3.2.4).
apiRouter.use('/', healthRoutes);

apiRouter.use('/auth', authRoutes);
apiRouter.use('/events', eventsRoutes);
apiRouter.use('/tickets', ticketsRoutes);
apiRouter.use('/listings', listingsRoutes);
apiRouter.use('/orders', ordersRoutes);
apiRouter.use('/webhooks', webhooksRoutes);
apiRouter.use('/organizer', organizerRoutes);
