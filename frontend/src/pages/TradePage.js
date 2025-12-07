import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import BottomNav from '../components/BottomNav';
import { apiFetch } from '../api';
import { API_URL } from '../config';

export default function TradePage(){
  const { token, user, login } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState('browse'); // 'browse' | 'sell' | 'trade'
  const [owned, setOwned] = useState([]);
  const [listings, setListings] = useState([]);
  const [browsePosts, setBrowsePosts] = useState([]);
  const [priceMap, setPriceMap] = useState({});
  const [offersIn, setOffersIn] = useState([]);
  const [offersOut, setOffersOut] = useState([]);
  const [offerPostId, setOfferPostId] = useState('');
  const [requestPostId, setRequestPostId] = useState('');
  const [message, setMessage] = useState('');
  const [selectedBrowsePost, setSelectedBrowsePost] = useState(null);

  const loadAll = async()=>{
    try{
      const headers = token? { Authorization:`Bearer ${token}` } : {};
      if(token){
        const a = await fetch(`${API_URL}/api/owned`, { headers });
        if(a.ok) setOwned(await a.json());
        const oin = await fetch(`${API_URL}/api/trades?dir=in`, { headers });
        if(oin.ok) setOffersIn(await oin.json());
        const oout = await fetch(`${API_URL}/api/trades?dir=out`, { headers });
        if(oout.ok) setOffersOut(await oout.json());
      }
      const l = await fetch(`${API_URL}/api/listings`);
      if(l.ok) setListings(await l.json());
      // Load all public posts for browsing
      const bp = await fetch(`${API_URL}/api/posts?limit=50`);
      if(bp.ok){
        const data = await bp.json();
        setBrowsePosts(data.posts || []);
      }
    }catch(_){ /* ignore */ }
  };
  const buyListing = async (listingId)=>{
    if(!token) return showToast('Login required','error');
    try{
      const r = await fetch(`${API_URL}/api/listings/${listingId}/buy`,{ method:'POST', headers:{ 'Authorization':`Bearer ${token}` } });
      const d = await r.json();
      if(r.ok){
        if(user){ login({ username: user.username, token, hearts: d.buyerHearts, userId: user.userId }); }
        showToast('Purchased successfully','success');
        loadAll();
      }else{
        showToast(d.error||'Purchase failed','error');
      }
    }catch(_){ showToast('Network error','error') }
  };
  useEffect(()=>{ loadAll(); },[token]);

  const listForSale = async (postId)=>{
    if(!token) return showToast('Login required','error');
    const price = parseInt(priceMap[postId]||'0',10);
    if(!price || price<=0) return showToast('Set a valid price','error');
    try{
      const r = await fetch(`${API_URL}/api/listings`,{ method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${token}` }, body: JSON.stringify({ postId, priceHearts: price }) });
      if(r.ok){ showToast('Listed for sale','success'); setPriceMap(m=>({ ...m, [postId]:'' })); loadAll(); } else { const d=await r.json(); showToast(d.error||'Failed','error') }
    }catch(_){ showToast('Network error','error') }
  };

  const actTrade = async (id, status)=>{
    if(!token) return;
    try{
      const r = await fetch(`${API_URL}/api/trades/${id}`,{ method:'PATCH', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${token}` }, body: JSON.stringify({ status }) });
      if(r.ok){ showToast('Updated','success'); loadAll(); } else { const d=await r.json(); showToast(d.error||'Failed','error') }
    }catch(_){ showToast('Network error','error') }
  }

  const sendOffer = async ()=>{
    if(!token) return showToast('Login required','error');
    if(!offerPostId || !requestPostId) return showToast('Select both emotions','error');
    try{
      const r = await fetch(`${API_URL}/api/trades`, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':`Bearer ${token}` }, body: JSON.stringify({ offerPostId, requestPostId, message }) });
      if(r.ok){ showToast('Offer sent','success'); setMessage(''); setOfferPostId(''); setRequestPostId(''); setSelectedBrowsePost(null); loadAll(); } else { const d=await r.json(); showToast(d.error||'Failed','error') }
    }catch(_){ showToast('Network error','error') }
  };

  const quickTradeOffer = (browsePost) => {
    if(!token) return showToast('Login required','error');
    setSelectedBrowsePost(browsePost);
    setRequestPostId(browsePost._id);
    setTab('trade');
  };

  return (
    <div className="app">
      <TopBar />
      <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
        <button className={tab==='browse'?'btn':'btn secondary'} onClick={()=>setTab('browse')}>Browse Posts</button>
        <button className={tab==='sell'?'btn':'btn secondary'} onClick={()=>setTab('sell')}>Sell</button>
        <button className={tab==='trade'?'btn':'btn secondary'} onClick={()=>setTab('trade')}>Trade</button>
      </div>
      {tab==='browse' && (
        <div style={{background:'var(--card)',padding:18,borderRadius:'var(--radius)',border:'1px solid rgba(255,255,255,0.04)'}}>
          <h2 style={{marginTop:0}}>Browse Posts for Trading</h2>
          <p className="tiny" style={{color:'var(--muted)',marginBottom:12}}>
            Browse all public posts. Click "Send Trade Offer" to propose a trade with the post owner.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {browsePosts.map(p=> (
              <div key={p._id} className="post">
                <div className="meta">
                  <strong>{p.emotion || 'Emotion'}</strong>
                  <small className="tiny">by {p.author}</small>
                </div>
                <h4 style={{margin:'8px 0'}}>{p.title}</h4>
                <p className="tiny" style={{color:'var(--muted)'}}>{p.hook || p.excerpt}</p>
                {p.images && p.images.length > 0 && (
                  <div className="post-image" style={{marginTop:8}}>
                    <img src={p.images[0]} alt={p.title} style={{width:'100%',height:180,objectFit:'cover',borderRadius:8}}/>
                  </div>
                )}
                <div className="meta-row" style={{marginTop:10,fontSize:12,color:'var(--muted)'}}>
                  <span>❤️ {p.likes || 0}</span>
                  <span>💬 {p.comments?.length || 0}</span>
                </div>
                <button 
                  className="btn" 
                  onClick={() => quickTradeOffer(p)} 
                  style={{marginTop:10,width:'100%'}}
                  disabled={!token || (user?.userId === p.userId)}
                >
                  {user?.userId === p.userId ? 'Your Post' : 'Send Trade Offer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab==='sell' && (
        <div style={{background:'var(--card)',padding:18,borderRadius:'var(--radius)',border:'1px solid rgba(255,255,255,0.04)'}}>
          <h2 style={{marginTop:0}}>Your Emotions for Sale</h2>
          <div className="tiny" style={{color:'var(--muted)'}}>Owned emotions</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12,marginTop:8}}>
            {owned.map(p=> (
              <div key={p._id} className="post">
                <div className="meta"><strong>{p.emotion}</strong><h4 style={{margin:0}}>{p.title}</h4></div>
                <p className="tiny">{p.hook || p.excerpt}</p>
                <div className="form" style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type='number' value={priceMap[p._id]||''} onChange={e=>setPriceMap(m=>({...m,[p._id]:e.target.value}))} placeholder='Price (hearts)'/>
                  <button className="btn" onClick={()=>listForSale(p._id)}>List for Sale</button>
                </div>
              </div>
            ))}
          </div>
          <h3 style={{marginTop:16}}>Market</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12,marginTop:8}}>
            {listings.map(l=> (
              <div key={l._id} className="post">
                <div className="meta"><strong>{l.post?.emotion}</strong><h4 style={{margin:0}}>{l.post?.title}</h4></div>
                <p className="tiny">💗 {l.priceHearts} · Seller: {String(l.sellerId).slice(-4)}</p>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn" onClick={()=>buyListing(l._id)} disabled={!token}>Buy</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='trade' && (
        <div style={{background:'var(--card)',padding:18,borderRadius:'var(--radius)',border:'1px solid rgba(255,255,255,0.04)'}}>
          <h2 style={{marginTop:0}}>Trade Your Emotions</h2>
          {selectedBrowsePost && (
            <div style={{background:'var(--panel)',padding:12,borderRadius:8,marginBottom:12,border:'1px solid rgba(255,255,255,0.04)'}}>
              <div className="tiny" style={{color:'var(--muted)',marginBottom:4}}>Selected post to request:</div>
              <strong>{selectedBrowsePost.title}</strong> <span className="tiny">by {selectedBrowsePost.author}</span>
              <button 
                className="btn secondary" 
                onClick={()=>{setSelectedBrowsePost(null); setRequestPostId('');}} 
                style={{marginLeft:10,padding:'4px 8px',fontSize:12}}
              >
                Clear
              </button>
            </div>
          )}
          <div className="form" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
            <select value={offerPostId} onChange={e=>setOfferPostId(e.target.value)}>
              <option value=''>Offer your emotion…</option>
              {owned.map(p=> <option key={p._id} value={p._id}>{p.title}</option>)}
            </select>
            {!selectedBrowsePost && (
              <select value={requestPostId} onChange={e=>setRequestPostId(e.target.value)}>
                <option value=''>Request this emotion…</option>
                {browsePosts.filter(p => p.userId !== user?.userId).map(p=> <option key={p._id} value={p._id}>{p.title} · by {p.author}</option>)}
              </select>
            )}
            <input value={message} onChange={e=>setMessage(e.target.value)} placeholder='Optional message'/>
            <button className='btn' onClick={sendOffer}>Send Trade Offer</button>
          </div>
          <h3 style={{marginTop:16}}>Incoming Offers</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12,marginTop:8}}>
            {offersIn.map(o=> (
              <div key={o._id} className='post'>
                <p className='tiny'>From: {o.fromUserId?.slice(-4)} | Message: {o.message||'-'}</p>
                <div style={{display:'flex',gap:8}}>
                  <button className='btn' onClick={()=>actTrade(o._id, 'accepted')}>Accept</button>
                  <button className='btn secondary' onClick={()=>actTrade(o._id, 'rejected')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
          <h3 style={{marginTop:16}}>Outgoing Offers</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12,marginTop:8}}>
            {offersOut.map(o=> (
              <div key={o._id} className='post'>
                <p className='tiny'>To: {o.toUserId?.slice(-4)} | Status: {o.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
