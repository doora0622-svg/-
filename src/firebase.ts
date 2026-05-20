import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// 使用用戶提供的 Firebase 設定資訊
const firebaseConfig = {
  apiKey: "AIzaSyBAQIqUo-jK5Zf1_rKVXfaWmdpxXylv9L0",
  authDomain: "exam-clock-db.firebaseapp.com",
  databaseURL: "https://exam-clock-db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "exam-clock-db",
  storageBucket: "exam-clock-db.firebasestorage.app",
  messagingSenderId: "427301555535",
  appId: "1:427301555535:web:5c79e289c2436bedb6093a",
  measurementId: "G-NPPJLWZC9K"
};

// 初始化 Firebase 應用
const app = initializeApp(firebaseConfig);

// 導出 Realtime Database 實例
export const db = getDatabase(app);
