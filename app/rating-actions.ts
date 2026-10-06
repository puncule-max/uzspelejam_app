"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function submitRating(formData: FormData) {
  const gameId=String(formData.get("game_id")??"").trim();
  const reviewedUserId=String(formData.get("reviewed_user_id")??"").trim();
  const rating=Number(String(formData.get("rating")??"0"));
  const comment=String(formData.get("comment")??"").trim();

  const supabase=await createClient();
  const { data:{ user } }=await supabase.auth.getUser();
  if(!user) redirect(`/login?next=/games/${gameId}/rate`);

  const { error }=await supabase.rpc("submit_rating",{
    p_game_id:gameId,
    p_reviewed_user_id:reviewedUserId,
    p_rating:rating,
    p_reliable:checked(formData,"reliable"),
    p_friendly:checked(formData,"friendly"),
    p_good_teammate:checked(formData,"good_teammate"),
    p_fair_player:checked(formData,"fair_player"),
    p_comment:comment||null,
  });

  if(error) redirect(`/games/${gameId}/rate?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}/rate`);
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}/rate?saved=1`);
}
