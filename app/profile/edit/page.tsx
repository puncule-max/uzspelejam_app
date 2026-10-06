import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { updateProfile } from "@/app/profile-edit-actions";

export default async function EditProfilePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const lv = locale === "lv";
  const rawError = typeof sp.error === "string" ? sp.error : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/edit");

  const [{data:profileRows},{data:safetyRows}] = await Promise.all([
    supabase.rpc("get_profile_detail",{p_user_id:user.id}),
    supabase.rpc("get_my_safety_state")
  ]);

  const profile:any = Array.isArray(profileRows) ? profileRows[0] : profileRows;
  const safety:any = Array.isArray(safetyRows) ? safetyRows[0] : safetyRows;
  const isMinor = Boolean(safety?.is_minor);

  const error = rawError === "TEEN_PROFILE_MUST_BE_PRIVATE"
    ? (lv ? "Lietotājiem līdz 18 gadu vecumam profils drošības dēļ paliek privāts." : "Profiles for users under 18 must remain private for safety.")
    : rawError === "AVATAR_TOO_LARGE"
      ? (lv ? "Profila attēls nedrīkst pārsniegt 5 MB." : "Profile image must be 5 MB or smaller.")
      : rawError === "AVATAR_INVALID_TYPE"
        ? (lv ? "Atļauti JPG, PNG un WebP attēli." : "Use a JPG, PNG or WebP image.")
        : rawError;

  return <div className="page narrow">
    <Link className="back" href="/profile">← {lv?"Profils":"Profile"}</Link>
    <p className="eyebrow">{lv?"Profils":"Profile"}</p>
    <h1>{lv?"Rediģēt profilu":"Edit profile"}</h1>
    {error && <p className="notice error">{error}</p>}

    {isMinor && <p className="notice">{lv
      ? "Teen Safety režīms ir aktīvs. Tavs profils paliek privāts."
      : "Teen Safety mode is active. Your profile remains private."}</p>}

    <form action={updateProfile} className="wizard" encType="multipart/form-data">
      {profile?.avatar_url&&<img className="avatar-large avatar-preview" src={profile.avatar_url} alt=""/>}
      <label>{lv?"Profila attēls":"Profile image"}
        <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"/>
        <span className="hint">{lv?"JPG, PNG vai WebP · līdz 5 MB":"JPG, PNG or WebP · up to 5 MB"}</span>
      </label>
      {profile?.avatar_url&&<label className="check-row"><input type="checkbox" name="remove_avatar"/><span>{lv?"Noņemt esošo attēlu":"Remove current image"}</span></label>}
      <label>{lv?"Vārds":"Display name"}
        <input name="display_name" required maxLength={80} defaultValue={profile?.display_name ?? ""}/>
      </label>
      <label>{lv?"Pilsēta":"City"}
        <input name="city" maxLength={120} defaultValue={profile?.city ?? ""} placeholder="Rīga"/>
      </label>
      <label>{lv?"Par mani":"About"}
        <textarea name="about" maxLength={1000} rows={5} defaultValue={profile?.about ?? ""}/>
      </label>
      <label>{lv?"Profila redzamība":"Profile visibility"}
        <select name="visibility" defaultValue={isMinor ? "private" : (profile?.visibility ?? "private")} disabled={isMinor}>
          <option value="private">{lv?"Privāts":"Private"}</option>
          <option value="public">{lv?"Publisks":"Public"}</option>
        </select>
      </label>
      {isMinor && <input type="hidden" name="visibility" value="private"/>}
      <button className="button primary wide" type="submit">{lv?"Saglabāt":"Save"}</button>
    </form>
  </div>;
}
