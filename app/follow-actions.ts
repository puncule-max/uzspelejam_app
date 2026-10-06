"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function saveFollowPreferences(formData: FormData) {
  const gameId = String(formData.get("game_id") ?? "").trim();
  if (!gameId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${gameId}/follow`);

  const { error } = await supabase.rpc("update_follow_preferences", {
    p_game_id: gameId,
    p_notify_spot_available: checked(formData,"notify_spot_available"),
    p_notify_fully_booked: checked(formData,"notify_fully_booked"),
    p_notify_date_change: checked(formData,"notify_date_change"),
    p_notify_time_change: checked(formData,"notify_time_change"),
    p_notify_venue_change: checked(formData,"notify_venue_change"),
    p_notify_price_change: checked(formData,"notify_price_change"),
    p_notify_new_players: checked(formData,"notify_new_players"),
    p_notify_booking_status: checked(formData,"notify_booking_status"),
    p_notify_cancelled: checked(formData,"notify_cancelled"),
    p_push_enabled: checked(formData,"push_enabled"),
  });

  if (error) redirect(`/games/${gameId}/follow?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/follow`);
  revalidatePath("/my-games");
  redirect(`/games/${gameId}`);
}
