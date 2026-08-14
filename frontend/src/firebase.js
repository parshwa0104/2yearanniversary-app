import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "loversforlife-app",
  appId: "1:664156222396:web:032d6049abe0e5c96ef1b9",
  storageBucket: "loversforlife-app.firebasestorage.app",
  apiKey: "AIzaSyBnjhNbCHrN9ds4H4Fm-PMMckaQSv2tSIw",
  authDomain: "loversforlife-app.firebaseapp.com",
  messagingSenderId: "664156222396",
  measurementId: "G-8PPEFY2KS2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
