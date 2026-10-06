"use client";

import { useMemo, useState } from "react";

const presets=[0,60,180,360,720,1440];

export function CancellationPolicyField({
  locale,
  currentMinutes=180,
  label
}:{locale:"lv"|"en";currentMinutes?:number|null;label:string}) {
  const initial=Number(currentMinutes??0);
  const isPreset=presets.includes(initial);
  const [selection,setSelection]=useState(isPreset?String(initial):"custom");
  const [customHours,setCustomHours]=useState(isPreset?3:Math.max(0.25,initial/60));

  const minutes=useMemo(
    ()=>selection==="custom"?Math.max(15,Math.round(customHours*60)):Number(selection),
    [selection,customHours]
  );

  return <fieldset className="field-group">
    <legend>{label}</legend>
    <select value={selection} onChange={e=>setSelection(e.target.value)}>
      <option value="0">{locale==="lv"?"Jebkurā laikā":"Anytime"}</option>
      <option value="60">1 h</option>
      <option value="180">3 h</option>
      <option value="360">6 h</option>
      <option value="720">12 h</option>
      <option value="1440">24 h</option>
      <option value="custom">{locale==="lv"?"Cits laiks":"Custom"}</option>
    </select>
    {selection==="custom"&&<label>
      {locale==="lv"?"Stundas pirms spēles":"Hours before the game"}
      <input
        type="number"
        min="0.25"
        max="168"
        step="0.25"
        value={customHours}
        onChange={e=>setCustomHours(Math.max(0.25,Number(e.target.value)||0.25))}
      />
    </label>}
    <input type="hidden" name="cancellation_policy_minutes" value={minutes}/>
    {selection==="custom"&&<span className="hint">
      {locale==="lv"?`Atcelšana bez kavējuma atzīmes līdz ${customHours} h pirms sākuma.`:`Cancel without a late-cancellation mark until ${customHours} h before start.`}
    </span>}
  </fieldset>;
}
