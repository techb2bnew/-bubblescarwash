import { createClient } from "@/lib/supabase/server";
import type { Extra } from "@/lib/types";
import ExtrasPageClient from "./extras-page-client";

export default async function AdminExtrasPage() {
  const supabase = await createClient();
  const { data: extras } = await supabase
    .from("extras")
    .select("*")
    .order("sort_order");

  return <ExtrasPageClient extras={(extras as Extra[]) ?? []} />;
}
