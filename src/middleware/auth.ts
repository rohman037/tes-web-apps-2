import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';
import { logger } from '../utils/logger';


export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAdminRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // We assume requireAuth has already run, so req.user should exist
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Missing user' });
  }

  // Cek klaim admin, atau bisa juga dicek berdasarkan email admin tertentu kalau belum di-setup claim-nya
  // Kalau belum pakai custom claims, kita bisa fallback cek email admin yang di hardcode atau lewat env.
  // Tapi sebaiknya pakai custom claims 'admin: true'.
  if (req.user.admin !== true) {
     logger.warn(`Attempt to access admin endpoint by non-admin: ${req.user.email}`);
     return res.status(403).json({ error: 'Forbidden: Requires Admin Role' });
  }

  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const accessCodeHeader =
    (req.headers['x-access-code'] as string) ||
    (req.headers['x-admin-code'] as string) ||
    (req.headers['x-client-access-code'] as string);
  const masterAdminCode = process.env.ADMIN_ACCESS_CODE ? process.env.ADMIN_ACCESS_CODE.trim() : null;
  const masterAdminEmails = ['ahmaddavid0906@gmail.com', 'globallensn@gmail.com'];
  const validAdminKeys = ['SATSET-ADMIN', 'ADMIN', 'SATSET-ULTRA-VIP'];
  if (masterAdminCode) {
    validAdminKeys.push(masterAdminCode);
  }

  // 1. Check x-access-code header if present
  if (accessCodeHeader) {
    const cleanHeader = accessCodeHeader.trim();
    const cleanLower = cleanHeader.toLowerCase();
    const cleanUpper = cleanHeader.toUpperCase();

    if (
      masterAdminEmails.includes(cleanLower) ||
      validAdminKeys.some((k) => k.toUpperCase() === cleanUpper)
    ) {
      req.user = { uid: 'admin_user', email: cleanLower.includes('@') ? cleanLower : 'ahmaddavid0906@gmail.com', admin: true } as any;
      return next();
    }
  }

  // 2. Check Authorization Bearer header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    const cleanLower = token.toLowerCase();
    const cleanUpper = token.toUpperCase();

    // Check if token matches exact master admin code or email
    if (
      masterAdminEmails.includes(cleanLower) ||
      validAdminKeys.some((k) => k.toUpperCase() === cleanUpper)
    ) {
      req.user = { uid: 'admin_user', email: cleanLower.includes('@') ? cleanLower : 'ahmaddavid0906@gmail.com', admin: true } as any;
      return next();
    }

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;

      // Auto-assign admin if email matches the master list
      if (req.user.email && masterAdminEmails.includes(req.user.email.toLowerCase())) {
        req.user.admin = true;
      }

      return next();
    } catch (error) {
      logger.warn('[Auth Middleware] Firebase ID token verification failed:', error);
    }
  }

  // Strict mode: Block unauthorized requests
  return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
};
