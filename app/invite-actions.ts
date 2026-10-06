"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPrivateInvite(formData: FormData) {
  const gameId = String(formData.get("game_id") ?? "").trim();
  const validHours = Number(String(formData.get("valid_hours") ?? "168"));
  if (!gameId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${gameId}/manage`);

  const { data, error } = await supabase.rpc("create_private_invite", {
    p_game_id: gameId,
    p_valid_hours: Number.isFinite(validHours) ? validHours : 168,
  });
  if (error) redirect(`/games/${gameId}/manage?error=${encodeURIComponent(error.message)}`);
  redirect(`/games/${gameId}/manage?invite=${encodeURIComponent(data)}`);
}

export async function claimPrivateInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);

  const { data, error } = await supabase.rpc("claim_private_invite", { p_token: token });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);
  redirect(`/games/${data}`);
}
