import { Router } from 'express';
import { testFirestoreHealth } from '../../db/dbService';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

router.get(['/health/firestore', '/db-health'], async (req, res) => {
  try {
    const isHealthy = await testFirestoreHealth();
    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      firestore: isHealthy,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      firestore: false,
      error: err?.message || 'Firestore connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
