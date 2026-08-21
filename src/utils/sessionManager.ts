'use client';

import { getUserSession, setUserSession, UserSession, MASTER_ADMIN_KEY, MASTER_ADMIN_EMAILS } from '../lib/auth';
import { getClients, ClientItem } from '../lib/admin/clients';

export interface ExtendedSessionInfo {
  session: UserSession | null;
  isValid: boolean;
  role: 'admin' | 'user' | 'guest';
  isExpired: boolean;
  daysRemaining?: number;
  clientData?: ClientItem | null;
}

/**
 * Validates session lifetime, role permissions, and active license details.
 */
export function getExtendedSessionInfo(): ExtendedSessionInfo {
  const session = getUserSession();
  if (!session || !session.code) {
    return {
      session: null,
      isValid: false,
      role: 'guest',
      isExpired: false,
      daysRemaining: 0,
      clientData: null,
    };
  }

  // Admin Role Validation
  const isMasterKey = Boolean(MASTER_ADMIN_KEY && session.code.toUpperCase() === MASTER_ADMIN_KEY.toUpperCase());
  const isMasterEmail = MASTER_ADMIN_EMAILS.some((e) => session.code.toUpperCase() === e.toUpperCase() || session.email?.toLowerCase() === e.toLowerCase());

  if (session.role === 'admin' || isMasterKey || isMasterEmail) {
    return {
      session,
      isValid: true,
      role: 'admin',
      isExpired: false,
      daysRemaining: 9999,
      clientData: null,
    };
  }

  // User Client Lookup
  const clients = getClients();
  const foundClient = clients.find(
    (c) => c.accessCode && c.accessCode.toUpperCase() === session.code.toUpperCase()
  );

  if (foundClient) {
    if (foundClient.status === 'suspended' || foundClient.status === 'expired') {
      return {
        session,
        isValid: false,
        role: 'user',
        isExpired: true,
        daysRemaining: 0,
        clientData: foundClient,
      };
    }

    // Check expiry timestamp if applicable
    const now = Date.now();
    let isExpired = false;
    let daysRemaining = 365;

    if (foundClient.expiryDate) {
      const expiryMs = new Date(foundClient.expiryDate).getTime();
      if (!isNaN(expiryMs)) {
        const diffMs = expiryMs - now;
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if (diffMs <= 0) {
          isExpired = true;
        }
      }
    }

    return {
      session,
      isValid: !isExpired,
      role: 'user',
      isExpired,
      daysRemaining,
      clientData: foundClient,
    };
  }

  // Fallback valid code
  return {
    session,
    isValid: true,
    role: 'user',
    isExpired: false,
    daysRemaining: 30,
    clientData: null,
  };
}

/**
 * Generates standardized admin authorization headers for requests to `/api/admin/*`
 */
export function getAdminRequestHeaders(): Record<string, string> {
  const session = getUserSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.code) {
    headers['x-admin-key'] = session.code;
    headers['Authorization'] = `Bearer ${session.code}`;
  }

  return headers;
}
