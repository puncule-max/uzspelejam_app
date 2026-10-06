"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function openNotification(formData:FormData){
  const id=String(formData.get("notification_id")??"").trim();
  const gameId=String(formData.get("game_id")??"").trim();
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/notifications");
  if(id) await supabase.rpc("mark_notification_read",{p_notification_id:id});
  revalidatePath("/notifications"); revalidatePath("/");
  redirect(gameId?"/games/"+gameId:"/notifications");
}

export async function markAllNotificationsRead(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/notifications");
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/notifications"); revalidatePath("/");
}
