"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function reportGame(formData: FormData) {
  const gameId = String(formData.get("game_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "other").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${gameId}`);
  const { error } = await supabase.rpc("report_game", { p_game_id: gameId, p_reason: reason, p_comment: comment || null });
  if (error) redirect(`/games/${gameId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/games/${gameId}?reported=1`);
}

export async function blockUser(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  const gameId = String(formData.get("game_id") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(gameId ? `/login?next=/games/${gameId}` : "/login");
  const { error } = await supabase.rpc("block_user", { p_user_id: userId });
  if (error) redirect(gameId ? `/games/${gameId}?error=${encodeURIComponent(error.message)}` : `/profile/blocked?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  redirect("/profile/blocked");
}

export async function unblockUser(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/blocked");
  const { error } = await supabase.rpc("unblock_user", { p_user_id: userId });
  if (error) redirect(`/profile/blocked?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/profile/blocked");
}
