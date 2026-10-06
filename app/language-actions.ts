"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setLanguage(formData: FormData) {
  const value = String(formData.get("language") ?? "lv") === "en" ? "en" : "lv";
  const cookieStore = await cookies();
  cookieStore.set("uz_locale", value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ language: value, updated_at: new Date().toISOString() }).eq("id", user.id);

  revalidatePath("/", "layout");
}
