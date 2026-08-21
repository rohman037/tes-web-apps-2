import { testFirestoreHealth } from '../db/dbService';

/**
 * Advanced Firebase Firestore Database Utility Helper
 * Provides robust connection management, retry logic, and health checking.
 */

// Helper to execute a database operation with automatic retry on transient failures
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      const isTransient =
        error.code === 'ECONNRESET' ||
        error.code === 14 || // UNAVAILABLE in gRPC
        error.code === 'UNAVAILABLE' ||
        error.code === 4 || // DEADLINE_EXCEEDED
        error.message?.includes('DEADLINE_EXCEEDED') ||
        error.message?.includes('ETIMEDOUT');

      if (!isTransient || attempt >= maxRetries) {
        console.error(`[Firebase DB Error] Operation failed after ${attempt} attempts:`, error);
        throw error;
      }

      console.warn(`[Firebase DB Warning] Transient error, retrying (${attempt}/${maxRetries}) in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Perform a Firebase Firestore database health check.
 * Useful for monitoring endpoints and liveness probes.
 */
export async function checkDatabaseHealth(): Promise<{
  status: string;
  latencyMs: number;
  error?: string;
  projectId?: string;
  firestoreDatabaseId?: string;
}> {
  const start = Date.now();
  try {
    const res = await testFirestoreHealth();
    return {
      status: res.ok ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      error: res.ok ? undefined : res.message,
      projectId: res.projectId,
      firestoreDatabaseId: res.firestoreDatabaseId,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error.message || String(error),
    };
  }
}

