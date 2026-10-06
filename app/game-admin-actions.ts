"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function rigaWallClockToIso(date: string, time: string) {
  const [y,m,d]=date.split("-").map(Number);
  const [hh,mm]=time.split(":").map(Number);
  const desired=Date.UTC(y,m-1,d,hh,mm,0);
  let guess=desired;
  const fmt=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Europe/Riga",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
  });
  for(let i=0;i<3;i++){
    const parts=Object.fromEntries(fmt.formatToParts(new Date(guess)).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
    const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
    guess+=desired-represented;
  }
  return new Date(guess).toISOString();
}

export async function updateGameDetails(formData: FormData) {
  const gameId=value(formData,"game_id");
  const date=value(formData,"date");
  const start=value(formData,"start_time");
  const end=value(formData,"end_time");
  if(!gameId||!date||!start||!end) return;

  const startsAt=rigaWallClockToIso(date,start);
  const endsAt=rigaWallClockToIso(date,end);

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/games/"+gameId+"/edit");

  const paymentMethod=value(formData,"payment_method")||"free";
  const totalCost=paymentMethod==="free"?0:Number(value(formData,"total_cost")||0);
  const venueRaw=value(formData,"venue_booked");
  const venueBooked=venueRaw==="true"?true:venueRaw==="false"?false:null;

  const {error}=await supabase.rpc("update_game_details",{
    p_game_id:gameId,
    p_starts_at:startsAt,
    p_ends_at:endsAt,
    p_custom_location:value(formData,"custom_location")||null,
    p_city:value(formData,"city")||null,
    p_online_platform:value(formData,"online_platform")||null,
    p_total_cost:totalCost,
    p_payment_method:paymentMethod,
    p_venue_booked:venueBooked,
    p_cancellation_policy_minutes:Number(value(formData,"cancellation_policy_minutes")||0),
    p_description:value(formData,"description")||null,
  });

  if(error) redirect("/games/"+gameId+"/edit?error="+encodeURIComponent(error.message));
  revalidatePath("/");
  revalidatePath("/games/"+gameId);
  revalidatePath("/games/"+gameId+"/manage");
  revalidatePath("/my-games");
  redirect("/games/"+gameId+"/manage?saved=1");
}

export async function cancelGame(formData: FormData) {
  const gameId=value(formData,"game_id");
  const reason=value(formData,"reason")||null;
  if(!gameId) return;

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/games/"+gameId+"/manage");

  const {error}=await supabase.rpc("cancel_game",{p_game_id:gameId,p_reason:reason});
  if(error) redirect("/games/"+gameId+"/manage?error="+encodeURIComponent(error.message));

  revalidatePath("/");
  revalidatePath("/games/"+gameId);
  revalidatePath("/games/"+gameId+"/manage");
  revalidatePath("/my-games");
  redirect("/games/"+gameId);
}
