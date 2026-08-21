import rateLimit from 'express-rate-limit';
import { API_RATE_LIMIT_WINDOW_MS, API_RATE_LIMIT_MAX } from '../config/constants';

export const apiRateLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  message: { error: 'Terlalu banyak permintaan (Rate limit). Silakan coba lagi sebentar lagi.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    return (
      url.includes('/api/events') ||
      url.includes('/api/health') ||
      url.includes('/api/ping') ||
      url.includes('/active-status') ||
      url.includes('/events/live') ||
      url.includes('/events/stream') ||
      url.includes('/events/poll')
    );
  },
});
