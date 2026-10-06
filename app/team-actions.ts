"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function assignParticipantTeam(formData: FormData) {
  const gameId=String(formData.get("game_id")??"").trim();
  const userId=String(formData.get("user_id")??"").trim();
  const teamId=String(formData.get("team_id")??"").trim()||null;

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect(`/login?next=/games/${gameId}/manage`);

  const {error}=await supabase.rpc("assign_participant_team",{
    p_game_id:gameId,
    p_user_id:userId,
    p_team_id:teamId,
  });
  if(error) redirect(`/games/${gameId}/manage?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/games/${gameId}/manage`);
  revalidatePath(`/games/${gameId}`);
}
