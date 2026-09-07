"use server";

import { createClient } from "@/lib/supabase/server";
import type { NotificationRecord } from "@/lib/types";

/** Registers (or refreshes) the current admin's own FCM token. */
export async function registerFcmToken(token: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_fcm_token", { p_token: token });
  if (error) throw new Error(error.message);
}

export interface RecentNotifications {
  notifications: NotificationRecord[];
  unreadCount: number;
}

export async function getRecentNotifications(): Promise<RecentNotifications> {
  const supabase = await createClient();
  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  return {
    notifications: (notifications as NotificationRecord[]) ?? [],
    unreadCount: unreadCount ?? 0,
  };
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
