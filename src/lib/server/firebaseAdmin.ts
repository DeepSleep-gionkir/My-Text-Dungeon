import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type AdminContext = {
  app: App;
  auth: Auth;
  db: Firestore;
};

declare global {
  // eslint-disable-next-line no-var
  var __firebaseAdmin: AdminContext | undefined;
}

function getCredential() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }
  return null;
}

export function getFirebaseAdmin(): AdminContext | null {
  if (globalThis.__firebaseAdmin) return globalThis.__firebaseAdmin;

  const existing = getApps();
  const app =
    existing.length > 0
      ? existing[0]!
      : (() => {
          const credential = getCredential();
          if (!credential) return null;
          return initializeApp({ credential });
        })();

  if (!app) return null;

  const auth = getAuth(app);
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });

  const ctx: AdminContext = { app, auth, db };
  globalThis.__firebaseAdmin = ctx;
  return ctx;
}

