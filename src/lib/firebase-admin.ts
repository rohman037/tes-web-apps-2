import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
    console.log(`[Firebase Admin] Initialized with applicationDefault() for project: ${firebaseConfig.projectId}`);
  } catch (e) {
    console.warn(`[Firebase Admin] Failed initializing applicationDefault credential, falling back:`, e);
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
}

export const adminAuth = getAuth();

// If firestoreDatabaseId is in config, use named database instance
export const adminDb = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(getApps()[0], firebaseConfig.firestoreDatabaseId)
  : getFirestore();

console.log(`[Firebase Admin] Firestore instance active. Target Project: "${firebaseConfig.projectId}", DatabaseID: "${firebaseConfig.firestoreDatabaseId || '(default)'}"`);

