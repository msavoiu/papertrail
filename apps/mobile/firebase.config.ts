// firebase.ts
import Constants from 'expo-constants';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const extra = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: extra.firebaseApiKey,
  authDomain: extra.firebaseAuthDomain,
  projectId: extra.firebaseProjectId,
  storageBucket: extra.firebaseStorageBucket,
  messagingSenderId: extra.firebaseMessagingSenderId,
  appId: extra.firebaseAppId,
};

// Initialize Firebase app
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence for React Native
initializeFirestore(app, {
  localCache: persistentLocalCache({
    cacheSizeBytes: 100000000
  })
});

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-west2');