"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LiveNotification={
  id:string;
  type:string;
  game_id:string|null;
  created_at:string;
};

const labels={
  lv:{
    application_received:"Jauns pieteikums",
    application_accepted:"Tu piedalies",
    application_declined:"Pieteikums noraidīts",
    spot_available:"Atbrīvojās vieta",
    fully_booked:"Spēle ir pilna",
    waiting_list_promoted:"Tu esi iekļauts spēlē",
    game_cancelled:"Spēle atcelta",
    date_changed:"Mainījās datums",
    time_changed:"Mainījās laiks",
    venue_changed:"Mainījās vieta",
    price_changed:"Mainījās cena",
    booking_status_changed:"Mainījās rezervācijas statuss",
    new_player:"Pievienojās jauns spēlētājs",
    participant_removed:"Tu vairs neesi spēles dalībnieks"
  },
  en:{
    application_received:"New join request",
    application_accepted:"You’re in",
    application_declined:"Request declined",
    spot_available:"A spot just opened up",
    fully_booked:"Game is fully booked",
    waiting_list_promoted:"You’re in from the waiting list",
    game_cancelled:"Game cancelled",
    date_changed:"Date changed",
    time_changed:"Time changed",
    venue_changed:"Venue changed",
    price_changed:"Price changed",
    booking_status_changed:"Booking status changed",
    new_player:"New player joined",
    participant_removed:"You were removed from the game"
  }
} as const;

export function NotificationToasts({locale}:{locale:"lv"|"en"}){
  const [toast,setToast]=useState<LiveNotification|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    const supabase=createClient();
    let active=true;
    let channel:ReturnType<typeof supabase.channel>|null=null;

    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!active||!user) return;
      channel=supabase
        .channel("notification-toasts-"+user.id)
        .on(
          "postgres_changes",
          {event:"INSERT",schema:"public",table:"notifications",filter:"user_id=eq."+user.id},
          payload=>{
            setToast(payload.new as LiveNotification);
            if(timer.current) clearTimeout(timer.current);
            timer.current=setTimeout(()=>setToast(null),6500);
          }
        )
        .subscribe();
    })();

    return ()=>{
      active=false;
      if(timer.current) clearTimeout(timer.current);
      if(channel) void supabase.removeChannel(channel);
    };
  },[]);

  if(!toast) return null;
  const label=(labels[locale] as Record<string,string>)[toast.type]??toast.type;

  return <aside className="live-toast" role="status" aria-live="polite">
    <button className="live-toast-close" type="button" onClick={()=>setToast(null)} aria-label={locale==="lv"?"Aizvērt":"Close"}>×</button>
    <strong>{label}</strong>
    <p>{locale==="lv"?"Ir jauns spēles paziņojums.":"There is a new game notification."}</p>
    <Link className="button primary" href="/notifications" onClick={()=>setToast(null)}>
      {locale==="lv"?"Skatīt":"View"}
    </Link>
  </aside>;
}
