import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import BottomNav from '../components/BottomNav';

export default function ProfileEditPage(){
  const { user, token, login } = useAuth();
  const { showToast } = useToast();
  const [username,setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [file, setFile] = useState(null);
  useEffect(()=>{ setUsername(user?.username||''); setAvatar(user?.avatar||'') },[user]);
  const upload = async ()=>{
    if(!token){ showToast('Login to edit profile','error'); return }
    if(!file){ showToast('Select a file','error'); return }
    const fd = new FormData(); fd.append('avatar', file);
    try{
      const r = await fetch('http://127.0.0.1:5000/api/profile/avatar',{method:'POST',headers:{'Authorization':`Bearer ${token}`},body:fd});
      const d = await r.json(); if(r.ok){ showToast('Avatar uploaded','success'); setAvatar(d.avatar); login({ username, token, hearts: user?.hearts || 5, userId: user?.userId }); } else showToast(d.error||'Upload failed','error')
    }catch(e){ showToast('Network error','error') }
  };
  return (
    <div className="app">
      <TopBar />
      <div style={{background:'var(--card)',padding:18,borderRadius:'var(--radius)',border:'1px solid rgba(255,255,255,0.04)'}}>
        <h2 style={{marginTop:0}}>Edit Profile</h2>
        <div className="form">
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder='Display username'/>
          <div style={{marginTop:8}}>
            {avatar && <img src={avatar} alt="avatar" style={{width:80,height:80,borderRadius:12,objectFit:'cover'}} />}
          </div>
          <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} />
          <button className="btn" onClick={upload}>Upload Avatar</button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
