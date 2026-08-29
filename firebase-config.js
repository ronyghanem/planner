// =====================================================
// FIREBASE CONFIGURATION
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCC5U1iuygCr6xrGLZp690IDEycqasJMXw",
    authDomain: "planner-63b4f.firebaseapp.com",
    projectId: "planner-63b4f",
    storageBucket: "planner-63b4f.firebasestorage.app",
    messagingSenderId: "444734837997",
    appId: "1:444734837997:web:25d2b6b7726cfb898928e4",
    measurementId: "G-QSNE0Z2R4X"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);