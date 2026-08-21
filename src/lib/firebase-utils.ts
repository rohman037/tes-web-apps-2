import { adminAuth, adminDb } from './firebase-admin';

/**
 * Advanced Firebase Admin Utilities
 * Provides secure backend operations for Auth & Firestore.
 */

export const firebaseUtils = {
  /**
   * Securely sync a user's metadata from Auth to Firestore
   * Ensures the database always matches the authentication truth state.
   */
  async syncUserToFirestore(uid: string) {
    try {
      const userRecord = await adminAuth.getUser(uid);
      
      const userData = {
        email: userRecord.email,
        name: userRecord.displayName || '',
        photoURL: userRecord.photoURL || null,
        emailVerified: userRecord.emailVerified,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        updatedAt: new Date().toISOString()
      };

      await adminDb.collection('users').doc(uid).set(userData, { merge: true });
      return { success: true, uid };
    } catch (error) {
      console.error(`[Firebase Utils] Error syncing user ${uid}:`, error);
      throw error;
    }
  },

  /**
   * Batch verify and decode multiple ID tokens.
   */
  async verifySession(authHeader: string | undefined) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Missing or invalid Bearer token');
    }
    
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      throw new Error('Unauthorized: Token verification failed');
    }
  }
};
