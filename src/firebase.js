import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAiY9OW7icJ51hwdJKhCDgbwwSEH8Uj74g",
  authDomain: "kidsapp-16032.firebaseapp.com",
  projectId: "kidsapp-16032",
  storageBucket: "kidsapp-16032.firebasestorage.app",
  messagingSenderId: "142413442901",
  appId: "1:142413442901:web:ff9e7f35597f4ab1a249dc",
  measurementId: "G-WGDRCDJW62"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
