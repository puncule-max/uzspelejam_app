import Link from "next/link";
import { notFound } from "next/navigation";
import { claimPrivateInvite } from "@/app/invite-actions";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime, skillLabel } from "@/lib/format";

export default async function InvitePage({ params, searchParams }: { params: Promise<{token:string}>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
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
    <p className="eyebrow">Private invitation</p>
    <h1>{preview.activity_name_en}</h1>
    <p className="lead">There’s a spot with your name on it.</p>
    {error && <p className="notice error">{error}</p>}
    <section className="panel">
      <div className="stack">
        <div><strong>When</strong><p>{formatGameDateTime(preview.starts_at)}</p></div>
        <div><strong>Where</strong><p>{location || "TBA"}</p></div>
        <div><strong>Needed</strong><p>{preview.additional_players_required} additional {preview.additional_players_required === 1 ? "player" : "players"}</p></div>
        <div><strong>Level</strong><p>{skillLabel(preview.required_skill_levels)}</p></div>
        <div><strong>Organizer</strong><p>{preview.organizer_name}</p></div>
      </div>
    </section>
    {user ? <form action={claimPrivateInvite}><input type="hidden" name="token" value={token}/><button className="button primary wide" type="submit">Open private game</button></form> :
      <div className="stack"><Link className="button primary wide" href={`/login?next=/invite/${encodeURIComponent(token)}`}>Sign in to continue</Link><Link className="button ghost wide" href={`/signup?next=/invite/${encodeURIComponent(token)}`}>Create account</Link></div>}
  </div>;
}
