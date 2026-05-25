import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, serverTimestamp } from '../lib/firebase';
import { doc, getDoc, setDoc, getDocFromCache, getDocFromServer } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  gmailToken: string | null;
  setGmailToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  gmailToken: null,
  setGmailToken: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [gmailToken, setGmailToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setGmailToken(null);
      }
      if (currentUser) {
        // Ensure user profile exists in firestore
        // Run this in the background to avoid blocking the loading state
        (async () => {
          const userRef = doc(db, 'users', currentUser.uid);
          
          const ensureUserExists = async (retries = 3): Promise<void> => {
            try {
              // Try cache first to avoid "offline" errors on startup
              let userSnap;
              try {
                userSnap = await getDocFromCache(userRef);
              } catch (cacheErr) {
                // If not in cache, try server
                userSnap = await getDoc(userRef);
              }

              if (!userSnap.exists()) {
                await setDoc(userRef, {
                  email: currentUser.email || '',
                  name: currentUser.displayName || 'Anonymous',
                  photoURL: currentUser.photoURL || '',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } else {
                // User exists
              }
            } catch (error: any) {
              const handled = handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
              
              if (handled && retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  return ensureUserExists(retries - 1);
              }
              
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return ensureUserExists(retries - 1);
              }
              console.warn('Failed to ensure user exists after retries, but proceeding:', error);
            }
          };

          await ensureUserExists();
        })();
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, gmailToken, setGmailToken }}>
      {children}
    </AuthContext.Provider>
  );
};
