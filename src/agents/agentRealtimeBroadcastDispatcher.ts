import { logAdminAction } from '../lib/admin/auditLog';

export interface DispatchResult {
  eventType: string;
  firestoreSynced: boolean;
  timestamp: string;
}

export async function dispatchRealtimeBroadcast(
  eventType: string,
  payload: any
): Promise<DispatchResult> {
  let firestoreSynced = false;
  const now = new Date().toISOString();

  // Mirror to Firestore live_state collection for real-time synchronization
  try {
    const isNode = typeof window === 'undefined' && typeof process !== 'undefined';
    if (isNode) {
      // Server-side: use Firebase Admin SDK
      const { adminDb } = await import('../lib/firebase-admin');
      if (adminDb && typeof adminDb.collection === 'function') {
        await adminDb.collection('live_state').doc(eventType).set({
          payload,
          updatedAt: now,
        }, { merge: true });
        firestoreSynced = true;
      }
    } else {
      // Client-side: use Client Firebase SDK
      const { db } = await import('../lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      if (db) {
        const docRef = doc(db, 'live_state', eventType);
        await setDoc(docRef, {
          payload,
          updatedAt: now,
        }, { merge: true });
        firestoreSynced = true;
      }
    }
  } catch (err: any) {
    // Non-blocking warning only
    console.warn(`[Realtime Broadcast] Live state sync notice for ${eventType}:`, err?.message || err);
  }

  logAdminAction(
    'Agent Realtime Broadcast Dispatcher',
    `Broadcast Dispatch: Event [${eventType}] -> Firestore Sync: ${firestoreSynced ? 'OK' : 'SKIPPED'}`,
    'system',
    'Agent Realtime Dispatcher'
  );

  return {
    eventType,
    firestoreSynced,
    timestamp: now,
  };
}

