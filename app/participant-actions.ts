"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function v(formData:FormData,key:string){return String(formData.get(key)??"").trim();}

export async function updateParticipantAssignment(formData:FormData){
  const gameId=v(formData,"game_id");
  const userId=v(formData,"user_id");
  const teamId=v(formData,"team_id")||null;
  const positionId=v(formData,"position_id")||null;

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/games/"+gameId+"/manage");

  const {error}=await supabase.rpc("update_participant_assignment",{
    p_game_id:gameId,p_user_id:userId,p_team_id:teamId,p_position_id:positionId
  });
  if(error) redirect("/games/"+gameId+"/manage?error="+encodeURIComponent(error.message));
  revalidatePath("/games/"+gameId);
  revalidatePath("/games/"+gameId+"/manage");
}

export async function removeParticipant(formData:FormData){
  const gameId=v(formData,"game_id");
  const userId=v(formData,"user_id");

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/games/"+gameId+"/manage");

  const {error}=await supabase.rpc("remove_participant",{p_game_id:gameId,p_user_id:userId});
  if(error) redirect("/games/"+gameId+"/manage?error="+encodeURIComponent(error.message));

  revalidatePath("/");
  revalidatePath("/games/"+gameId);
  revalidatePath("/games/"+gameId+"/manage");
  revalidatePath("/my-games");
}
