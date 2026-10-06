"use client";
import { useState } from "react";

export function ShareButton({label,text}:{label:string;text:string}){
  const [done,setDone]=useState(false);
  async function share(){
    const url=window.location.href;
    if(navigator.share){
      try{await navigator.share({title:document.title,text,url});return;}catch{}
    }
    try{await navigator.clipboard.writeText(url);setDone(true);setTimeout(()=>setDone(false),1800);}catch{}
  }
  return <button className="button ghost" type="button" onClick={share}>{done?"✓":label}</button>;
}
