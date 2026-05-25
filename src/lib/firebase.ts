import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, serverTimestamp as fsServerTimestamp, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence, onSnapshot } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const config = (firebaseConfig as any);
console.log('Firebase Config Data:', JSON.stringify(config));
console.log('firestoreDatabaseId:', config.firestoreDatabaseId);
export const db = config.firestoreDatabaseId 
  ? getFirestore(app, config.firestoreDatabaseId) 
  : getFirestore(app);
// Enable Firestore persistence for better offline support
// if (typeof window !== 'undefined') {
//   enableMultiTabIndexedDbPersistence(db).catch((err) => {
//       if (err.code === 'failed-precondition') {
//           // Multiple tabs open, persistence can only be enabled in one
//           console.warn('Firestore persistence enabled in another tab.');
//       } else if (err.code === 'unimplemented') {
//           // The current browser does not support persistence
//           console.warn('Firestore persistence not supported in this browser.');
//       } else {
//           console.error('Firestore persistence error:', err);
//       }
//   });
// }

export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logoutUser = () => signOut(auth);

export const serverTimestamp = fsServerTimestamp;

// Utility to check online status
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// Utility for error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  SYNC = 'sync'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;

  const isOfflineError = 
    errCode === 'unavailable' ||
    errCode === 'deadline-exceeded' ||
    errorMessage.toLowerCase().includes('offline') || 
    errorMessage.toLowerCase().includes('unavailable') || 
    errorMessage.toLowerCase().includes('failed to get document') || 
    errorMessage.toLowerCase().includes('network') ||
    errorMessage.toLowerCase().includes('deadline-exceeded');

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  
  if (isOfflineError) {
    console.warn(`Firestore Offline/Transient Error [${operationType}] at [${path}]:`, errorMessage);
    return true; 
  }

  // Handle permission errors explicitly
  if (errCode === 'permission-denied') {
    console.error('Firestore Permission Denied:', path, errInfo);
    return false;
  }

  console.error('Firestore Fatal Error: ', JSON.stringify(errInfo));
  return false;
}

// Custom helper for snapshot listeners
export const createSnapshotListener = (
  query: any,
  onNext: (snapshot: any) => void,
  onError: (error: any) => void,
  path: string
) => {
  return onSnapshot(query, onNext, (error: any) => {
    const handled = handleFirestoreError(error, OperationType.SYNC, path);
    if (!handled) {
      onError(error);
    }
  });
};
