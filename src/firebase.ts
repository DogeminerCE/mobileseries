import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCl4htMBsqlVshK36oAnAWT4Dtebv7exSY",
  authDomain: "mobileseriesxyz.firebaseapp.com",
  projectId: "mobileseriesxyz",
  storageBucket: "mobileseriesxyz.firebasestorage.app",
  messagingSenderId: "947239763383",
  appId: "1:947239763383:web:fbb5cb592a72b044aebc32",
  measurementId: "G-GDD3Y2TMKQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
