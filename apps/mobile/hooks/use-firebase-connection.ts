import { useState, useEffect } from 'react';
import { Firestore, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';

export function useFirebaseConnection() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Create a test collection reference to monitor connection state
    const testRef = collection(db, '_connectionTest');
    
    // Set up a listener that will fail if we're offline
    const unsubscribe = onSnapshot(
      testRef,
      () => {
        setIsOnline(true);
      },
      (error) => {
        if (error.code === 'unavailable') {
          setIsOnline(false);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline };
}