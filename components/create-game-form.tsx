"use client";

import { useMemo, useState } from "react";
import { createGame } from "@/app/game-actions";

type Activity={
  id:string;
  code:string;
  name_lv:string;
  name_en:string;
  play_mode:"physical"|"online"|"both";
  supports_positions:boolean;
};
type Position={id:string;activity_id:string;name_lv:string;name_en:string;sort_order:number};
type Labels=Record<string,string>;

export function CreateGameForm({
  locale,activities,positions,labels
}:{locale:"lv"|"en";activities:Activity[];positions:Position[];labels:Labels}) {
  const first=activities[0]??null;
  const initialMode: "physical"|"online" = first?.play_mode==="online"?"online":"physical";
  const [activityId,setActivityId]=useState(first?.id??"");
  const [mode,setMode]=useState<"physical"|"online">(initialMode);
  const [playersNeeded,setPlayersNeeded]=useState(1);
  const [requirements,setRequirements]=useState<Record<string,number>>({});
  const [payment,setPayment]=useState("free");
  const [totalCost,setTotalCost]=useState(0);
  const [organizerShare,setOrganizerShare]=useState(true);

  const activity=activities.find(a=>a.id===activityId)??first;
  const activityPositions=useMemo(
    ()=>positions.filter(p=>p.activity_id===activityId),
    [positions,activityId]
  );
  const requirementTotal=Object.values(requirements).reduce((sum,n)=>sum+(Number.isFinite(n)?n:0),0);
  const overCapacity=requirementTotal>playersNeeded;
  const payerCount=Math.max(1,playersNeeded+(organizerShare?1:0));
  const perPlayer=totalCost>0?totalCost/payerCount:0;

  function changeActivity(id:string){
    setActivityId(id);
    setRequirements({});
    const next=activities.find(a=>a.id===id);
    if(next?.play_mode==="online") setMode("online");
    else if(next?.play_mode==="physical") setMode("physical");
    else if(next?.play_mode==="both" && mode!=="physical" && mode!=="online") setMode("physical");
  }

  const modeOptions=activity?.play_mode==="online"
    ? [{value:"online",label:labels.online}]
    : activity?.play_mode==="physical"
      ? [{value:"physical",label:labels.physical}]
      : [{value:"physical",label:labels.physical},{value:"online",label:labels.online}];

  return <form action={createGame} className="wizard">
    <label>{labels.activity}
      <select name="activity_id" required value={activityId} onChange={e=>changeActivity(e.target.value)}>
        {activities.map(a=><option key={a.id} value={a.id}>{locale==="lv"?a.name_lv:a.name_en}</option>)}
      </select>
    </label>

    <label>{labels.mode}
      <select name="mode" value={mode} onChange={e=>setMode(e.target.value as "physical"|"online")}>
        {modeOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>

    <div className="two-col">
      <label>{labels.date}<input name="date" type="date" required/></label>
      <label>{labels.start}<input name="start_time" type="time" required/></label>
    </div>
    <label>{labels.end}<input name="end_time" type="time" required/></label>

    {mode==="physical"?<>
      <label>{labels.location}<input name="location" placeholder="MyFitness Sāga, Rīga" required/></label>
      <label>{labels.city}<input name="city" placeholder="Rīga"/></label>
      <label>{labels.venueBooked}
        <select name="venue_booked" defaultValue="false">
          <option value="false">{labels.notBooked}</option>
          <option value="true">{labels.booked}</option>
        </select>
      </label>
    </>:<>
      <label>{labels.platform}<input name="online_platform" placeholder="Chess.com, Lichess" required/></label>
    </>}

    <label>{labels.howManyMissing}
      <input
        name="players_needed"
        type="number"
        min="1"
        value={playersNeeded}
        onChange={e=>setPlayersNeeded(Math.max(1,Number(e.target.value)||1))}
        required
      />
    </label>

    {activity?.supports_positions&&activityPositions.length>0&&<section className="panel">
      <h2>{labels.positions}</h2>
      <p className="hint">{labels.positionsHint}</p>
      <div className="stack">
        {activityPositions.map(p=><label className="position-create-row" key={p.id}>
          <span>{locale==="lv"?p.name_lv:p.name_en}</span>
          <span className="hint">{labels.requiredCount}</span>
          <input
            name={"position_requirement_"+p.id}
            type="number"
            min="0"
            max={playersNeeded}
            value={requirements[p.id]??0}
            onChange={e=>setRequirements(current=>({...current,[p.id]:Math.max(0,Number(e.target.value)||0)}))}
          />
        </label>)}
      </div>
      {overCapacity&&<p className="notice error">{labels.positionOverCapacity}</p>}
    </section>}

    <label>{labels.skill}<select name="skill" defaultValue="any">
      <option value="any">{labels.anyLevel}</option>
      <option value="beginner">{labels.beginner}</option>
      <option value="intermediate">{labels.intermediate}</option>
      <option value="advanced">{labels.advanced}</option>
    </select></label>

    <label>{labels.genderPreference}<select name="gender_preference" defaultValue="anyone">
      <option value="anyone">{labels.anyone}</option>
      <option value="men">{labels.men}</option>
      <option value="women">{labels.women}</option>
      <option value="mixed">{labels.mixed}</option>
    </select></label>

    <label>{labels.payment}<select name="payment_method" value={payment} onChange={e=>setPayment(e.target.value)}>
      <option value="free">{labels.free}</option>
      <option value="pay_at_venue">{labels.payAtVenue}</option>
      <option value="pay_in_advance">{labels.payInAdvance}</option>
    </select></label>
    {payment!=="free"&&<>
      <label>{labels.totalCost}<input name="total_cost" type="number" min="0" step="0.01" value={totalCost} onChange={e=>setTotalCost(Math.max(0,Number(e.target.value)||0))}/></label>
      <label className="check-row"><input name="organizer_share_included" type="checkbox" checked={organizerShare} onChange={e=>setOrganizerShare(e.target.checked)}/><span>{labels.organizerShare}</span></label>
      {totalCost>0&&<p className="hint">≈ €{perPlayer.toFixed(2)} · {labels.perPlayer}</p>}
    </>}

    <label>{labels.cancellation}<select name="cancellation_policy_minutes" defaultValue="180">
      <option value="0">{labels.anytime}</option>
      <option value="60">1 h</option><option value="180">3 h</option><option value="360">6 h</option>
      <option value="720">12 h</option><option value="1440">24 h</option>
    </select></label>

    <label>{labels.visibility}<select name="visibility" defaultValue="public">
      <option value="public">{labels.public}</option><option value="private">{labels.private}</option>
    </select></label>

    <label>{labels.notes}<textarea name="description" rows={4}/></label>
    <button type="submit" className="button primary wide" disabled={overCapacity||!activityId}>{labels.publish}</button>
  </form>;
}
