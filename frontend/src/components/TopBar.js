import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useHearts } from "../contexts/HeartContext";
import { useAuth } from "../contexts/AuthContext";
import useScrollDirection from "../hooks/useScrollDirection";

export default function TopBar() {
  const { hearts } = useHearts();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const visible = useScrollDirection();
  const doLogout = () => { logout(); nav('/'); };
  const [theme, setTheme] = React.useState(() => localStorage.getItem('theme') || 'dark');
  const [accent, setAccent] = React.useState(() => localStorage.getItem('accent') || '#7c5cff');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-2', accent);
    localStorage.setItem('accent', accent);
  }, [accent]);
  return (
    <header className={`topbar ${visible ? 'visible' : 'hidden'}`}>
      <Link to="/" className="brand">Emotionally</Link>
      <nav className="nav">
        {user && <span style={{color:'var(--accent)',fontWeight:600,fontSize:14}}>@{user.username}</span>}
        {user && (
          <button className="btn secondary" onClick={doLogout} style={{fontSize:12}}>
            Logout
          </button>
        )}
        <label style={{display:'inline-flex',alignItems:'center',gap:8}}>
          <span className="tiny" style={{marginRight:4}}>Theme</span>
          <button className="btn secondary" onClick={()=> setTheme(t=> t==='dark'?'light':'dark')} aria-label="Toggle theme">
            {theme==='dark' ? '🌙' : '☀️'}
          </button>
        </label>
        <label style={{display:'inline-flex',alignItems:'center',gap:8}}>
          <span className="tiny">Accent</span>
          <input type="color" value={accent} onChange={(e)=> setAccent(e.target.value)} aria-label="Pick accent color" style={{width:36,height:36,padding:0,border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,background:'transparent'}} />
        </label>
      </nav>
    </header>
  );
}

