import Link from "next/link";
import { notFound } from "next/navigation";
import { claimPrivateInvite } from "@/app/invite-actions";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime, skillLabel } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n";

export default async function InvitePage({ params, searchParams }: { params: Promise<{token:string}>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const locale = await getLocale(); const lv = locale === "lv"; const t = getDictionary(locale);
  const error = typeof sp.error === "string" ? sp.error : null;
  const supabase = await createClient();
  const [{ data: { user } }, previewRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("preview_private_game",{ p_token: token })
  ]);
  const preview = Array.isArray(previewRes.data) ? previewRes.data[0] : previewRes.data;
  if (!preview) notFound();

  const location = preview.mode === "online" ? `Online · ${preview.online_platform ?? ""}` : [preview.custom_location,preview.city].filter(Boolean).join(" · ");

  return <div className="page narrow">
    <p className="eyebrow">{lv ? "Privāts ielūgums" : "Private invitation"}</p>
    <h1>{lv ? preview.activity_name_lv : preview.activity_name_en}</h1>
    <p className="lead">{lv ? "Šajā spēlē ir vieta tev." : "There’s a spot with your name on it."}</p>
    {error && <p className="notice error">{error}</p>}
    <section className="panel">
      <div className="stack">
        <div><strong>{t.when}</strong><p>{formatGameDateTime(preview.starts_at,locale)}</p></div>
        <div><strong>{t.where}</strong><p>{location || (lv ? "Vieta tiks precizēta" : "TBA")}</p></div>
        <div><strong>{lv ? "Vajadzīgi" : "Needed"}</strong><p>{preview.additional_players_required} {lv ? "papildu spēlētāji" : `additional ${preview.additional_players_required === 1 ? "player" : "players"}`}</p></div>
        <div><strong>{t.level}</strong><p>{skillLabel(preview.required_skill_levels,locale)}</p></div>
        <div><strong>{lv ? "Organizators" : "Organizer"}</strong><p>{preview.organizer_name}</p></div>
      </div>
    </section>
    {user ? <form action={claimPrivateInvite}><input type="hidden" name="token" value={token}/><button className="button primary wide" type="submit">{lv ? "Atvērt privāto spēli" : "Open private game"}</button></form> :
      <div className="stack"><Link className="button primary wide" href={`/login?next=/invite/${encodeURIComponent(token)}`}>{lv ? "Ieiet, lai turpinātu" : "Sign in to continue"}</Link><Link className="button ghost wide" href={`/signup?next=/invite/${encodeURIComponent(token)}`}>{lv ? "Izveidot kontu" : "Create account"}</Link></div>}
  </div>;
}
