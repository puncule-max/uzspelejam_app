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
  const avatar = formData.get("avatar");
  const removeAvatar = String(formData.get("remove_avatar") ?? "") === "on";

  if (!displayName || displayName.length > 80) {
    redirect("/profile/edit?error=" + encodeURIComponent("INVALID_DISPLAY_NAME"));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/edit");

  let avatarUrl: string | null | undefined = undefined;
  if (removeAvatar) {
    await supabase.storage.from("avatars").remove([user.id + "/avatar"]);
    avatarUrl = null;
  } else if (avatar instanceof File && avatar.size > 0) {
    const allowed = ["image/jpeg","image/png","image/webp"];
    if (avatar.size > 5 * 1024 * 1024) {
      redirect("/profile/edit?error=" + encodeURIComponent("AVATAR_TOO_LARGE"));
    }
    if (!allowed.includes(avatar.type)) {
      redirect("/profile/edit?error=" + encodeURIComponent("AVATAR_INVALID_TYPE"));
    }
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(user.id + "/avatar", avatar, { upsert: true, contentType: avatar.type, cacheControl: "3600" });
    if (uploadError) redirect("/profile/edit?error=" + encodeURIComponent(uploadError.message));
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(user.id + "/avatar");
    avatarUrl = publicData.publicUrl + "?v=" + Date.now();
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      city,
      about,
      visibility,
    })
    .eq("id",user.id);

  if (error) {
    redirect("/profile/edit?error=" + encodeURIComponent(error.message));
  }

  if (avatarUrl !== undefined) {
    const { error: avatarError } = await supabase.rpc("set_my_avatar_url", {
      p_avatar_url: avatarUrl,
    });
    if (avatarError) {
      redirect("/profile/edit?error=" + encodeURIComponent(avatarError.message));
    }
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/users/" + user.id);
  redirect("/profile");
}
