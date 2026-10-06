import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n";
import { CreateGameForm } from "@/components/create-game-form";

export default async function CreatePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  const locale=await getLocale(); const t=getDictionary(locale);
  const error=typeof params.error==="string"?params.error:null;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/create");

  const [{data:activities},{data:positions}]=await Promise.all([
    supabase.from("activities")
      .select("id,code,name_lv,name_en,play_mode,supports_positions")
      .eq("active",true)
      .order(locale==="lv"?"name_lv":"name_en"),
    supabase.from("positions")
      .select("id,activity_id,name_lv,name_en,sort_order")
      .eq("active",true)
      .order("sort_order")
  ]);

  const labels={
    activity:t.activity,mode:t.mode,physical:t.physical,online:t.online,
    date:t.date,start:t.start,end:t.end,location:t.location,city:t.city,platform:t.platform,
    howManyMissing:t.howManyMissing,skill:t.skill,anyLevel:t.anyLevel,beginner:t.beginner,
    intermediate:t.intermediate,advanced:t.advanced,genderPreference:t.genderPreference,
    anyone:t.anyone,men:t.men,women:t.women,mixed:t.mixed,payment:t.payment,free:t.free,
    payAtVenue:t.payAtVenue,payInAdvance:t.payInAdvance,totalCost:t.totalCost,
    venueBooked:t.venueBooked,notBooked:t.notBooked,booked:t.booked,cancellation:t.cancellation,
    anytime:t.anytime,visibility:t.visibility,public:t.public,private:t.private,notes:t.notes,
    publish:t.publish,
    positions:locale==="lv"?"Kuras pozīcijas trūkst?":"Which positions are missing?",
    positionsHint:locale==="lv"?"Norādi tikai tās pozīcijas, kurām vajag konkrētu spēlētāju skaitu.":"Only set counts for positions you specifically need.",
    requiredCount:locale==="lv"?"Vajag":"Needed",
    positionOverCapacity:locale==="lv"?"Pozīciju summa nevar pārsniegt trūkstošo cilvēku skaitu.":"Position requirements cannot exceed the number of missing people."
  };

  return <div className="page">
    <p className="eyebrow">{t.createEyebrow}</p>
    <h1>{t.whoMissing}</h1>
    <p className="lead">{t.createLead}</p>
    {error&&<p className="notice error">{error}</p>}
    <CreateGameForm
      locale={locale}
      activities={(activities??[]) as any}
      positions={(positions??[]) as any}
      labels={labels}
    />
  </div>;
}
