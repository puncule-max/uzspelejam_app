"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setPositionRequirement(formData: FormData) {
  const gameId=String(formData.get("game_id")??"").trim();
  const positionId=String(formData.get("position_id")??"").trim();
  const requiredCount=Math.max(0,Number(String(formData.get("required_count")??"0")));
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect(`/login?next=/games/${gameId}/manage`);

  const {error}=await supabase.rpc("set_position_requirement",{
    p_game_id:gameId,
    p_position_id:positionId,
    p_required_count:requiredCount,
  });
  if(error) redirect(`/games/${gameId}/manage?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/games/${gameId}/manage`);
  revalidatePath(`/games/${gameId}`);
}
