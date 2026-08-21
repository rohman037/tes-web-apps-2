import { Express } from 'express';
import healthRoutes from './healthRoutes';

export function registerRoutes(app: Express) {
  // Mount health check sub-router
  app.use('/api', healthRoutes);
}
