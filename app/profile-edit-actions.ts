"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0,max) : null;
}

export async function updateProfile(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const city = clean(formData.get("city"),120);
  const about = clean(formData.get("about"),1000);
  const visibility = String(formData.get("visibility") ?? "private") === "public" ? "public" : "private";

  if (!displayName || displayName.length > 80) {
    redirect("/profile/edit?error=" + encodeURIComponent("INVALID_DISPLAY_NAME"));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/edit");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      city,
      about,
      visibility,
      updated_at: new Date().toISOString(),
    })
    .eq("id",user.id);

  if (error) {
    redirect("/profile/edit?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/users/" + user.id);
  redirect("/profile");
}
