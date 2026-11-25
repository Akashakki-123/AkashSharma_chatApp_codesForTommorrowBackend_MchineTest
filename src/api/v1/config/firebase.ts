import "dotenv/config";
import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp, ServiceAccount } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

function loadServiceAccountFromFile(): ServiceAccount | null {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!filePath) {
    return null;
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase service account file not found at: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8");
  return JSON.parse(raw) as ServiceAccount;
}

function loadServiceAccountFromEnv(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();

  if (!projectId || !privateKey || !clientEmail) {
    return null;
  }

  return {
    projectId,
    privateKey,
    clientEmail,
  };
}

let firestoreInstance: Firestore | null = null;

export function initFirebase(): boolean {
  if (getApps().length > 0) {
    if (!firestoreInstance) {
      firestoreInstance = getFirestore();
    }
    return true;
  }

  try {
    const credentials = loadServiceAccountFromFile() ?? loadServiceAccountFromEnv();
    if (!credentials) {
      console.warn(
        "Firebase credentials are incomplete. Firestore chat features require FIREBASE_* env vars or FIREBASE_SERVICE_ACCOUNT_PATH."
      );
      return false;
    }

    initializeApp({
      credential: cert(credentials),
    });

    firestoreInstance = getFirestore();
    console.log("Firebase Firestore initialized successfully");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to initialize Firebase Admin: ${message}`);
    return false;
  }
}

export const firebaseEnabled = initFirebase();

export function getFirestoreDb(): Firestore | null {
  if (!firestoreInstance && !initFirebase()) {
    return null;
  }
  return firestoreInstance;
}
