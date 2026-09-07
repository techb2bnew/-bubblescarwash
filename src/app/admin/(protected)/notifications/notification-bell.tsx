"use client";

import { useEffect, useRef, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import type { NotificationRecord } from "@/lib/types";
import { getFirebaseMessaging, isPushConfiguredClient } from "@/lib/firebase-client";
import { getRecentNotifications, markAllNotificationsRead, registerFcmToken } from "./actions";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [permission, setPermission] = useState<NotificationPermission | null>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : null,
  );
  const [requesting, setRequesting] = useState(false);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRecentNotifications().then(({ notifications, unreadCount }) => {
      setNotifications(notifications);
      setUnreadCount(unreadCount);
    });
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    let unsubscribe: (() => void) | undefined;
    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return;
      unsubscribe = onMessage(messaging, (payload) => {
        setNotifications((prev) => [
          {
            id: payload.data?.bookingId ?? crypto.randomUUID(),
            type: "booking_created",
            title: payload.notification?.title ?? "New notification",
            body: payload.notification?.body ?? "",
            data: payload.data ?? {},
            read_at: null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setUnreadCount((c) => c + 1);
      });
    });
    return () => unsubscribe?.();
  }, [permission]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleEnable() {
    if (!isPushConfiguredClient()) return;
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      await registerFcmToken(token);
    } catch (err) {
      console.error("[notification-bell] enable failed:", err);
    } finally {
      setRequesting(false);
    }
  }

  async function handleToggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      try {
        await markAllNotificationsRead();
      } catch (err) {
        console.error("[notification-bell] markAllNotificationsRead failed:", err);
      }
    }
  }

  const showEnableButton = isPushConfiguredClient() && permission !== "granted";

  return (
    <div ref={containerRef} className="flex items-center gap-2">
      {showEnableButton && (
        <button
          onClick={handleEnable}
          disabled={requesting}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {requesting ? "Enabling…" : "Enable notifications"}
        </button>
      )}
      <div className="relative">
        <button
          onClick={handleToggleOpen}
          aria-label="Notifications"
          className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notifications
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="border-b border-gray-50 px-4 py-3 last:border-0">
                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{n.body}</div>
                    <div className="mt-1 text-[11px] text-gray-400">{timeAgo(n.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
