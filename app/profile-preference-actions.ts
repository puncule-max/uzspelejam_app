"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveUserActivity(formData: FormData) {
  const activityId=String(formData.get("activity_id")??"").trim();
  const enabled=formData.get("enabled")==="on";
  const skillRaw=String(formData.get("skill_level")??"").trim();
  const skill=["beginner","intermediate","advanced"].includes(skillRaw)?skillRaw:null;

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/profile/preferences");

  const {error}=await supabase.rpc("set_user_activity",{
    p_activity_id:activityId,
    p_enabled:enabled,
    p_skill_level:skill,
  });
  if(error) redirect(`/profile/preferences?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/profile/preferences");
  revalidatePath("/profile");
}

export async function savePreferredPosition(formData: FormData) {
  const positionId=String(formData.get("position_id")??"").trim();
  const enabled=formData.get("enabled")==="on";
  const priority=Number(String(formData.get("priority")??"1"));

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/profile/preferences");

  const {error}=await supabase.rpc("set_preferred_position",{
    p_position_id:positionId,
    p_enabled:enabled,
    p_priority:Number.isFinite(priority)?priority:1,
  });
  if(error) redirect(`/profile/preferences?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/profile/preferences");
  revalidatePath("/profile");
}
