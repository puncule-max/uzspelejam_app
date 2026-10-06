import { redirect } from "next/navigation";
import { createGame } from "@/app/game-actions";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n";

export default async function CreatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const locale = await getLocale(); const t = getDictionary(locale);
  const error = typeof params.error === "string" ? params.error : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/create");
  const { data: activities } = await supabase.from("activities").select("id,code,name_lv,name_en,play_mode").eq("active", true).order(locale === "lv" ? "name_lv" : "name_en");
  return <div className="page"><p className="eyebrow">{t.createEyebrow}</p><h1>{t.whoMissing}</h1><p className="lead">{t.createLead}</p>{error && <p className="notice error">{error}</p>}<form action={createGame} className="wizard">
    <label>{t.activity}<select name="activity_id" required>{activities?.map(a => <option key={a.id} value={a.id}>{locale === "lv" ? a.name_lv : a.name_en}</option>)}</select></label>
    <label>{t.mode}<select name="mode" defaultValue="physical"><option value="physical">{t.physical}</option><option value="online">{t.online}</option></select></label>
    <div className="two-col"><label>{t.date}<input name="date" type="date" required /></label><label>{t.start}<input name="start_time" type="time" required /></label></div>
    <label>{t.end}<input name="end_time" type="time" required /></label>
    <label>{t.location}<input name="location" placeholder="MyFitness Sāga, Rīga" /></label>
    <label>{t.city}<input name="city" placeholder="Rīga" /></label>
    <label>{t.platform}<input name="online_platform" placeholder="Chess.com, Lichess" /></label>
    <label>{t.howManyMissing}<input name="players_needed" type="number" min="1" defaultValue="1" required /></label>
    <label>{t.skill}<select name="skill" defaultValue="any"><option value="any">{t.anyLevel}</option><option value="beginner">{t.beginner}</option><option value="intermediate">{t.intermediate}</option><option value="advanced">{t.advanced}</option></select></label>
    <label>{t.genderPreference}<select name="gender_preference" defaultValue="anyone"><option value="anyone">{t.anyone}</option><option value="men">{t.men}</option><option value="women">{t.women}</option><option value="mixed">{t.mixed}</option></select></label>
    <label>{t.payment}<select name="payment_method" defaultValue="free"><option value="free">{t.free}</option><option value="pay_at_venue">{t.payAtVenue}</option><option value="pay_in_advance">{t.payInAdvance}</option></select></label>
    <label>{t.totalCost}<input name="total_cost" type="number" min="0" step="0.01" defaultValue="0" /></label>
    <label>{t.venueBooked}<select name="venue_booked" defaultValue="false"><option value="false">{t.notBooked}</option><option value="true">{t.booked}</option></select></label>
    <label>{t.cancellation}<select name="cancellation_policy_minutes" defaultValue="180"><option value="0">{t.anytime}</option><option value="60">1 h</option><option value="180">3 h</option><option value="360">6 h</option><option value="720">12 h</option><option value="1440">24 h</option></select></label>
    <label>{t.visibility}<select name="visibility" defaultValue="public"><option value="public">{t.public}</option><option value="private">{t.private}</option></select></label>
    <label>{t.notes}<textarea name="description" rows={4} /></label>
    <button type="submit" className="button primary wide">{t.publish}</button>
  </form></div>;
}
