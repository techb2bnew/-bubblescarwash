import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Served at /firebase-messaging-sw.js (the fixed path the Firebase SDK looks
 * for). A route handler rather than a static public/ file so the (public,
 * not-secret) web config can come from env vars instead of being hardcoded
 * twice. Uses importScripts + the compat SDK, since a service worker can't
 * resolve bare npm imports without its own bundler step.
 */
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const script = `
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

if (firebase.messaging.isSupported()) {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "New notification";
    const body = payload.notification?.body ?? "";
    self.registration.showNotification(title, {
      body,
      icon: "/Bubbles-Logo.png",
      data: payload.data ?? {},
    });
  });
}
`;

  return new NextResponse(script, {
    headers: { "Content-Type": "application/javascript" },
  });
}
