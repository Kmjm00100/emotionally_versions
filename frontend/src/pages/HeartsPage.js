import React, { useState } from "react";
import { useHearts } from "../contexts/HeartContext";
import GetHeartsModal from '../components/GetHeartsModal';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

export default function HeartsPage(){
  const { hearts, addHearts } = useHearts();
  const [open, setOpen] = useState(false);
  return(
    <div className="app">
      <TopBar />
      <div style={{background:'var(--card)',padding:18,borderRadius:'var(--radius)',border:'1px solid rgba(255,255,255,0.04)'}}>
        <h2 style={{marginTop:0}}>Hearts: {hearts}</h2>
        <button className="btn" onClick={()=>setOpen(true)}>Get More</button>
      </div>
      {open && <GetHeartsModal onClose={()=>setOpen(false)} />}
      <BottomNav />
    </div>
  );
}
