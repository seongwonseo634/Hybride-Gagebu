import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query } from 'firebase/firestore';
import { db, createSnapshotListener } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { PersonalTransaction } from '../types';

interface TransactionsContextType {
  transactions: PersonalTransaction[];
  loading: boolean;
}

const TransactionsContext = createContext<TransactionsContextType>({
  transactions: [],
  loading: true,
});

export const useTransactions = () => useContext(TransactionsContext);

export const TransactionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/transactions`));

    const unsubscribe = createSnapshotListener(
      q,
      (snapshot) => {
        const txs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PersonalTransaction[];
        txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setTransactions(txs);
        setLoading(false);
      },
      (error) => {
        console.error('Transactions context fetch error:', error);
        setLoading(false);
      },
      `users/${user.uid}/transactions`
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <TransactionsContext.Provider value={{ transactions, loading }}>
      {children}
    </TransactionsContext.Provider>
  );
};
