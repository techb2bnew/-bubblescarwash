"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, messagingSenderId, appId };
}

export function isPushConfiguredClient(): boolean {
  return getFirebaseConfig() !== null && Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
}

function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseConfig();
  if (!config) return null;
  return getApps()[0] ?? initializeApp(config);
}

/** Null if unconfigured, or if the browser doesn't support push (e.g. Safari on some versions). */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!(await isSupported())) return null;
  return getMessaging(app);
}
