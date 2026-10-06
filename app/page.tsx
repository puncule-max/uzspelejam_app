import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime, skillLabel } from "@/lib/format";
import { getDictionary, getLocale, interpolate } from "@/lib/i18n";

type SearchParams = Record<string,string|string[]|undefined>;
function one(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value;}
function buildUrl(current:SearchParams,changes:Record<string,string|null>){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(current)){const v=one(value);if(v)params.set(key,v);}
  for(const [key,value] of Object.entries(changes)){if(!value)params.delete(key);else params.set(key,value);}
  const q=params.toString(); return q?`/?${q}`:"/";
}

export default async function ExplorePage({searchParams}:{searchParams:Promise<SearchParams>}){
  const params=await searchParams;
  const locale=await getLocale(); const t=getDictionary(locale); const lv=locale==="lv";

  const query=one(params.q)??"";
  const quick=one(params.quick)??"";
  const modeRaw=one(params.mode)??"";
  const mode=modeRaw==="online"||modeRaw==="physical"?modeRaw:null;
  const openOnly=one(params.open)==="1";
  const activityId=one(params.activity)??"";
  const category=one(params.category)??"";
  const city=one(params.city)??"";
  const skillRaw=one(params.skill)??"";
  const skill=["beginner","intermediate","advanced"].includes(skillRaw)?skillRaw:null;
  const genderRaw=one(params.gender)??"";
  const gender=["anyone","men","women","mixed"].includes(genderRaw)?genderRaw:null;
  const priceRaw=one(params.price)??"";
  const price=priceRaw==="free"||priceRaw==="paid"?priceRaw:null;
  const bookedRaw=one(params.booked)??"";
  const venueBooked=bookedRaw==="yes"?true:bookedRaw==="no"?false:null;

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();

  const [gamesRes,activitiesRes,unreadRes]=await Promise.all([
    supabase.rpc("list_public_games_filtered",{
      p_limit:50,p_query:query||null,p_mode:mode,p_quick:quick||null,p_open_only:openOnly,
      p_activity_id:activityId||null,p_category:category||null,p_city:city||null,
      p_skill:skill,p_gender:gender,p_price:price,p_venue_booked:venueBooked
    }),
    supabase.from("activities").select("id,name_lv,name_en,category").eq("active",true).order(locale==="lv"?"name_lv":"name_en"),
    user?supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null):Promise.resolve({count:0})
  ] as any);

  const games=gamesRes.data??[];
  const activities=activitiesRes.data??[];
  const categories=[...new Set(activities.map((a:any)=>a.category).filter(Boolean))].sort();
  const unreadCount=unreadRes.count??0;
  const hasAdvanced=Boolean(activityId||category||city||skill||gender||price||bookedRaw||mode==="physical");

  const quickFilters=[
    {key:"today",label:t.today,href:buildUrl(params,{quick:quick==="today"?null:"today"})},
    {key:"tomorrow",label:t.tomorrow,href:buildUrl(params,{quick:quick==="tomorrow"?null:"tomorrow"})},
    {key:"week",label:t.thisWeek,href:buildUrl(params,{quick:quick==="week"?null:"week"})},
    {key:"online",label:t.online,href:buildUrl(params,{mode:mode==="online"?null:"online"})},
    {key:"open",label:t.openSpots,href:buildUrl(params,{open:openOnly?null:"1"})},
  ];

  return <div className="page">
    <header className="topbar"><div><p className="eyebrow">Wanna play, my friend?</p><h1>{process.env.NEXT_PUBLIC_APP_NAME||t.brand}</h1></div><div className="top-actions">{user&&<Link className="icon-button notification-link" href="/notifications" aria-label={t.notifications}>{unreadCount>0?"●":"○"}</Link>}{user?<Link className="text-button" href="/profile">{t.profile}</Link>:<Link className="button ghost" href="/login">{t.signIn}</Link>}</div></header>
    <section className="hero"><h2>{t.heroTitle}</h2><p>{t.heroBody}</p><div className="hero-actions"><Link className="button primary" href={user?"/create":"/login?next=/create"}>{t.createGame}</Link><span className="button ghost">You in?</span></div></section>

    <form action="/" method="get">
      <div className="search-form">
        <input className="search" name="q" defaultValue={query} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder}/>
        <button className="button primary" type="submit">{lv?"Meklēt":"Search"}</button>
      </div>

      <details className="panel filter-panel" open={hasAdvanced}>
        <summary>{lv?"Filtri":"Filters"}{hasAdvanced?" · ✓":""}</summary>
        <div className="filter-grid">
          <label>{lv?"Aktivitāte":"Activity"}<select name="activity" defaultValue={activityId}><option value="">{lv?"Visas":"All"}</option>{activities.map((a:any)=><option key={a.id} value={a.id}>{lv?a.name_lv:a.name_en}</option>)}</select></label>
          <label>{lv?"Kategorija":"Category"}<select name="category" defaultValue={category}><option value="">{lv?"Visas":"All"}</option>{categories.map((c:any)=><option key={c} value={c}>{c}</option>)}</select></label>
          <label>{lv?"Pilsēta":"City"}<input name="city" defaultValue={city} placeholder="Rīga"/></label>
          <label>{lv?"Veids":"Mode"}<select name="mode" defaultValue={mode??""}><option value="">{lv?"Visi":"All"}</option><option value="physical">{lv?"Klātienē":"Physical"}</option><option value="online">Online</option></select></label>
          <label>{lv?"Līmenis":"Skill"}<select name="skill" defaultValue={skillRaw}><option value="">{lv?"Jebkurš":"Any"}</option><option value="beginner">{lv?"Iesācējs":"Beginner"}</option><option value="intermediate">{lv?"Vidējs":"Intermediate"}</option><option value="advanced">{lv?"Pieredzējis":"Advanced"}</option></select></label>
          <label>{lv?"Dzimuma preference":"Gender preference"}<select name="gender" defaultValue={genderRaw}><option value="">{lv?"Jebkura":"Any"}</option><option value="anyone">{lv?"Jebkurš":"Anyone"}</option><option value="men">{lv?"Vīrieši":"Men"}</option><option value="women">{lv?"Sievietes":"Women"}</option><option value="mixed">{lv?"Jaukts":"Mixed"}</option></select></label>
          <label>{lv?"Cena":"Price"}<select name="price" defaultValue={priceRaw}><option value="">{lv?"Jebkura":"Any"}</option><option value="free">{t.free}</option><option value="paid">{lv?"Maksas":"Paid"}</option></select></label>
          <label>{lv?"Vieta rezervēta":"Venue booked"}<select name="booked" defaultValue={bookedRaw}><option value="">{lv?"Nav svarīgi":"Any"}</option><option value="yes">{lv?"Jā":"Yes"}</option><option value="no">{lv?"Nē":"No"}</option></select></label>
        </div>
        {quick&&<input type="hidden" name="quick" value={quick}/>}
        {openOnly&&<input type="hidden" name="open" value="1"/>}
        <div className="filter-actions"><button className="button primary" type="submit">{lv?"Pielietot filtrus":"Apply filters"}</button><Link className="button ghost" href="/">{lv?"Notīrīt":"Clear"}</Link></div>
      </details>
    </form>

    <div className="chips">{quickFilters.map(f=>{const active=(f.key==="today"&&quick==="today")||(f.key==="tomorrow"&&quick==="tomorrow")||(f.key==="week"&&quick==="week")||(f.key==="online"&&mode==="online")||(f.key==="open"&&openOnly);return <Link className={`chip ${active?"active":""}`} href={f.href} key={f.key}>{f.label}</Link>;})}</div>

    <div className="section-heading"><h2>{t.games}</h2><span>{games.length}</span></div>
    <div className="card-list">
      {games.map((g:any)=>{const full=Number(g.remaining_players)===0;const missing=Number(g.remaining_players);const activityName=lv?g.activity_name_lv:g.activity_name_en;return <Link className="game-card" href={`/games/${g.id}`} key={g.id}>
        <div className="card-top"><strong>{activityName??"Game"}</strong><span className="status">{full?t.fullyBooked:`${missing} ${t.spotsLeft}`}</span></div>
        <h3>{full?t.joinWaitingList:missing===1?t.oneMissing:interpolate(t.manyMissing,{count:missing})}</h3>
        <p>{formatGameDateTime(g.starts_at,locale)}</p>
        <p>{g.mode==="online"?`Online · ${g.online_platform}`:[g.custom_location,g.city].filter(Boolean).join(" · ")}</p>
        <div className="meta-row"><span>{skillLabel(g.required_skill_levels,locale)}</span><span>{g.payment_method==="free"?t.free:`€${Number(g.total_cost).toFixed(2)}`}</span></div>
        <div className="progress-line"><span>{g.accepted_players_count} {t.confirmed}</span><span>{full?t.following:`${missing} ${t.spotsLeft}`}</span></div>
      </Link>;})}
      {!games.length&&<section className="panel"><h3>{t.noGames}</h3><p>{query||quick||hasAdvanced||openOnly?(lv?"Pamēģini citu meklēšanu vai filtru.":"Try another search or filter."):t.beFirst}</p><Link className="button primary" href={user?"/create":"/login?next=/create"}>{t.createGame}</Link></section>}
    </div>
  </div>;
}
