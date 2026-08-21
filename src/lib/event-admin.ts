import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

export interface EventAdminProfile {
  uid: string;
  email: string;
  name: string;
  role: 'master_admin' | 'event_admin';
  isEventAdmin: boolean;
  assignedEventId?: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export const EVENT_ADMIN_EMAIL = 'davidrohman037@gmail.com';

/**
 * Ensures the Event Admin profile is initialized in Firestore
 */
export async function bootstrapEventAdmin(uid: string, email: string = EVENT_ADMIN_EMAIL, name: string = 'Event Master Admin'): Promise<EventAdminProfile> {
  const adminRef = doc(db, 'admins', uid);
  const now = new Date().toISOString();

  try {
    const snap = await getDoc(adminRef);
    if (snap.exists()) {
      const data = snap.data() as EventAdminProfile;
      return data;
    }

    const newProfile: EventAdminProfile = {
      uid,
      email,
      name,
      role: 'master_admin',
      isEventAdmin: true,
      permissions: ['manage_all', 'event_control', 'issue_codes', 'view_audit', 'live_broadcast'],
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(adminRef, newProfile);
    console.log(`[EventAdmin] Admin profile bootstrapped for ${email}`);
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admins/${uid}`);
    throw error;
  }
}

/**
 * Log an audit event securely into Firestore
 */
export async function recordAuditEvent(
  action: string,
  details: string,
  category: 'package' | 'client' | 'apikey' | 'qris' | 'system' | 'event_admin' | 'security' = 'event_admin',
  adminEmail: string = EVENT_ADMIN_EMAIL,
  adminName: string = 'Event Admin'
) {
  try {
    const logRef = collection(db, 'audit_logs');
    await addDoc(logRef, {
      adminEmail,
      adminName,
      action,
      details,
      category,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[EventAdmin] Failed logging audit to Firestore (continuing locally):', error);
  }
}

/**
 * Update realtime live state / broadcast banner
 */
export async function updateLiveBroadcast(
  message: string,
  status: 'live' | 'standby' | 'ended' = 'live',
  isMaintenance: boolean = false
) {
  try {
    const liveRef = doc(db, 'live_state', 'current_state');
    await setDoc(
      liveRef,
      {
        activeBroadcastMessage: message,
        currentEventStatus: status,
        isMaintenance,
        eventAdminEmail: EVENT_ADMIN_EMAIL,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'live_state/current_state');
  }
}

/**
 * Subscribe to realtime live state
 */
export function subscribeLiveState(callback: (state: any) => void) {
  try {
    const liveRef = doc(db, 'live_state', 'current_state');
    return onSnapshot(liveRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      }
    });
  } catch (e) {
    console.warn('[EventAdmin] Error subscribing to live state:', e);
    return () => {};
  }
}
