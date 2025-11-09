import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AIAnalysisCard from './AIAnalysisCard';

export default function PostCard({ post }) {
  const date = new Date(post.createdAt).toLocaleString();
  const [i, setI] = useState(0);
  const imgsRaw = post.images || [];
  const BACKEND_ORIGIN = process.env.REACT_APP_API || 'http://127.0.0.1:5000';
  const navigate = useNavigate();

  // normalize image URLs: allow absolute URLs, or join backend origin with paths like '/uploads/x' or 'uploads/x'
  const imgs = imgsRaw.map(raw => {
    const src = (raw || '').toString().trim();
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    // ensure leading slash
    const path = src.startsWith('/') ? src : '/' + src;
    // remove any double slashes when joining
    return (BACKEND_ORIGIN.replace(/\/$/, '') + path);
  }).filter(Boolean);

  const ref = useRef();
  const next = () => setI(n => (n + 1) % imgs.length);
  const prev = () => setI(n => (n - 1 + imgs.length) % imgs.length);

  // social: like & comments
  const { token, user, login } = useAuth();
  const [likes, setLikes] = useState(post.likes || 0);
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [cText, setCText] = useState('');
  const [listing, setListing] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    // initial liked guess based on likedBy if present and user in context
    try {
      const lb = post.likedBy || [];
      if (user && user.userId && lb.some(x => (x || '').toString() === user.userId)) setLiked(true);
    } catch (_) { /* noop */ }
  }, [post.likedBy, user]);

  const toggleLike = async () => {
    if (!token) return; // optional: show toast, but keep component isolated
    try {
      const r = await fetch(`${BACKEND_ORIGIN}/api/posts/${post._id}/like`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) { setLikes(d.likes); setLiked(d.liked); }
    } catch (_) { /* ignore */ }
  };

  const loadComments = async () => {
    try {
      const r = await fetch(`${BACKEND_ORIGIN}/api/posts/${post._id}/comments`);
      const d = await r.json();
      if (r.ok) setComments(d.comments || []);
    } catch (_) { setComments([]) }
  };

  const addComment = async () => {
    if (!token || !cText.trim()) return;
    try {
      const r = await fetch(`${BACKEND_ORIGIN}/api/posts/${post._id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ text: cText }) });
      const d = await r.json();
      if (r.ok) { setComments(cs => [...cs, d.comment]); setCText(''); }
    } catch (_) { /* ignore */ }
  };

  useEffect(() => { if (showComments) loadComments(); }, [showComments]);

  useEffect(() => {
    const run = async () => {
      try{
        const r = await fetch(`${BACKEND_ORIGIN}/api/listings?postId=${post._id}`);
        const d = await r.json();
        if(Array.isArray(d) && d.length) setListing(d[0]); else setListing(null);
      }catch(_){ setListing(null) }
    };
    if(post?._id) run();
  }, [post?._id]);

  const buy = async ()=>{
    if(!listing?._id) return;
    if(!token){
      navigate('/login');
      return;
    }
    try{
      const r = await fetch(`${BACKEND_ORIGIN}/api/listings/${listing._id}/buy`, { method:'POST', headers:{ 'Authorization':`Bearer ${token}` } });
      const d = await r.json();
      if(r.ok){
        if(user){ login({ username: user.username, token, hearts: d.buyerHearts, userId: user.userId }); }
        setListing(null);
      }
    }catch(_){ /* ignore */ }
  };

  const deletePost = async () => {
    if (!token) return;
    console.log('Deleting post:', post._id);
    console.log('User:', user);
    console.log('Token:', token ? 'Present' : 'Missing');
    try {
      const r = await fetch(`${BACKEND_ORIGIN}/api/posts/${post._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Response status:', r.status);
      const data = await r.json();
      console.log('Response data:', data);
      if (r.ok) {
        window.location.reload(); // Refresh to show updated list
      } else {
        console.error('Delete failed:', data.error);
        alert(data.error || 'Failed to delete post');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete post');
    }
  };

  // Check ownership - compare both userId and ownerId with the logged-in user
  const isOwner = user && user.userId && (
    (post.userId && user.userId.toString() === post.userId.toString()) ||
    (post.ownerId && user.userId.toString() === post.ownerId.toString())
  );
  
  console.log('Ownership check:', {
    user: user?.userId,
    postUserId: post.userId,
    postOwnerId: post.ownerId,
    isOwner
  });

  // keyboard navigation
  useEffect(() => {
    const h = (e) => {
      if (!imgs.length) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [imgs.length]);

  // touch swipe
  useEffect(() => {
    let startX = 0;
    const el = ref.current;
    if (!el) return;
    const onStart = (e) => startX = e.touches ? e.touches[0].clientX : e.clientX;
    const onEnd = (e) => {
      const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const dx = endX - startX;
      if (Math.abs(dx) > 40) { if (dx > 0) prev(); else next(); }
    };
    el.addEventListener('touchstart', onStart);
    el.addEventListener('touchend', onEnd);
    el.addEventListener('mousedown', onStart);
    el.addEventListener('mouseup', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('mousedown', onStart);
      el.removeEventListener('mouseup', onEnd);
    };
  }, [imgs.length]);

  const rarity = (post.rarity || 'Common');
  const short = post.hook || post.excerpt || (post.content || '').slice(0, 160);
  return (
    <article className="post" aria-labelledby={`post-${post._id}`}>
      {imgs.length > 0 && (
        <div className="post-image" ref={ref}>
          <img src={imgs[i]} alt="post image" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%230b0a10"/><text x="50%" y="50%" fill="%23aaa" font-size="20" text-anchor="middle">Image not available</text></svg>' }} data-src={imgs[i]} />
          {imgs.length > 1 && <div className="carousel-controls"><button onClick={prev} className="btn secondary" aria-label="Previous image">‹</button><button onClick={next} className="btn secondary" aria-label="Next image">›</button></div>}
          {imgs.length > 1 && <div className="dots">{imgs.map((_, idx) => <button key={idx} aria-label={`Go to image ${idx + 1}`} className={idx === i ? 'active' : ''} onClick={() => setI(idx)}>{'•'}</button>)}</div>}
          {imgs.length > 1 && <div className="img-count" aria-live="polite">{i + 1}/{imgs.length}</div>}
        </div>
      )}
      <div className="meta"><strong>{post.emotion}</strong><h4 id={`post-${post._id}`} style={{ margin: 0 }}>{post.title}</h4></div>
      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:4}}>
        <span className="pill">{rarity}</span>
      </div>
      <p className="tiny">{short}</p>
      
      {/* AI Analysis Badge */}
      {post.aiAnalysis && post.aiAnalysis.source && post.aiAnalysis.source !== 'none' && (
        <AIAnalysisCard analysis={post.aiAnalysis} compact={true} />
      )}
      
      {listing && (
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
          <span className="pill">💗 {listing.priceHearts}</span>
          <button className="btn" onClick={buy}>Buy</button>
        </div>
      )}
      {!listing && (
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
          <Link to="/trade" className="btn secondary">See Market</Link>
        </div>
      )}
      <div className="meta-row tiny" style={{ marginTop: 8 }}>
        <span>By {post.userId ? <Link to={`/profile?user=${post.userId}`}>{post.author}</Link> : post.author}</span>
        <span>{date}</span>
      </div>
      <div className="actions-row">
        <button className={liked ? 'btn' : 'btn secondary'} onClick={toggleLike} disabled={!token} aria-pressed={liked} aria-label="Like">
          ❤️ {likes}
        </button>
        <button className="btn secondary" onClick={() => setShowComments(v => !v)} aria-expanded={showComments} aria-controls={`comments-${post._id}`}>
          💬 {comments.length || (post.comments ? post.comments.length : 0)}
        </button>
        {isOwner && (
          <button className="btn" style={{marginLeft: 'auto', background: '#e74c3c', fontSize: '20px', padding: '8px 12px'}} onClick={() => setShowDeleteConfirm(true)} aria-label="Delete post">
            🗑️
          </button>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{fontSize: '48px', textAlign: 'center', marginBottom: '16px'}}>⚠️</div>
            <h3 style={{margin: '0 0 12px 0', textAlign: 'center', color: 'var(--accent)'}}>Delete Post?</h3>
            <p style={{margin: '0 0 24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px'}}>
              This action cannot be undone. Your post and all associated data will be permanently deleted.
            </p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
              <button 
                className="btn secondary" 
                onClick={() => setShowDeleteConfirm(false)}
                style={{flex: 1}}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                onClick={() => { deletePost(); setShowDeleteConfirm(false); }}
                style={{flex: 1, background: '#e74c3c'}}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Full AI Analysis - show when comments are open */}
      {showComments && post.aiAnalysis && post.aiAnalysis.source && post.aiAnalysis.source !== 'none' && (
        <AIAnalysisCard analysis={post.aiAnalysis} />
      )}
      
      {showComments && (
        <div id={`comments-${post._id}`} className="comments">
          <div className="comments-list">
            {comments.map((c, idx) => (
              <div key={idx} className="comment-item"><strong>{c.username || 'user'}:</strong> <span>{c.text}</span></div>
            ))}
            {comments.length === 0 && <div className="tiny" style={{ color: 'var(--muted)' }}>No comments yet</div>}
          </div>
          <div className="comment-form">
            <input value={cText} onChange={e => setCText(e.target.value)} placeholder={token ? 'Write a comment...' : 'Login to comment'} disabled={!token} />
            <button className="btn" onClick={addComment} disabled={!token || !cText.trim()}>Post</button>
          </div>
        </div>
      )}
    </article>
  );
}
