import React, { useState, useEffect, useRef } from "react";
import TopBar from "../components/TopBar";
import Feed from "../components/Feed";
import BottomNav from "../components/BottomNav";
import Spinner from "../components/Spinner";
import { API_URL } from '../config';

export default function HomePage() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  useEffect(()=>{
    fetch(`${API_URL}/api/posts?page=${page}&limit=6`).then(r=>r.json()).then(data=>{
      if(!data) return setPosts([]);
      setPosts(p=> page === 1 ? data.posts : [...p, ...data.posts]);
      setPages(data.pages || 1);
    }).catch(()=>{
      if(page === 1) setPosts([]);
    });
  },[page]);

  // infinite scroll sentinel
  const sentinel = useRef();
  useEffect(()=>{
    const obs = new IntersectionObserver(entries=>{
      entries.forEach(ent=>{
        if(ent.isIntersecting && page < pages){
          setPage(p=>p+1);
        }
      })
    },{root:null,rootMargin:'200px',threshold:0.1});
    if(sentinel.current) obs.observe(sentinel.current);
    return ()=> obs.disconnect();
  },[page,pages]);

  // listen for manual refresh event (e.g., after creating a post)
  useEffect(()=>{
    const h = ()=>{ setPage(1); };
    window.addEventListener('refreshPosts', h);
    return ()=> window.removeEventListener('refreshPosts', h);
  },[]);
  return(
    <div className="app">
      <TopBar/>

      <div className="hero">
        <div className="label">✨ Daily Inspiration</div>
        <div className="quote">"Every emotion is a message from your soul. What is yours trying to tell you today?"</div>
        <div className="cta"><button className="btn secondary">Today's Wisdom</button></div>
      </div>

      <div className="featured-header"><span className="icon">📈</span><h3 style={{margin:0}}>Featured Emotion</h3></div>
      <div className="featured-card">
        <div className="pill">Love</div>
        <h2 style={{margin:'6px 0'}}>Unexpected Love Story</h2>
        <p className="tiny">It happened when I least expected it. Love found me in a coffee shop queue on a rainy Tuesday morning...</p>
        <div className="meta-row"><span>👤 Emma Thompson (32)</span><span>1 day ago</span><span>👁 2103</span></div>
      </div>

  <div style={{marginTop:16}}>
    <Feed posts={posts} single={true}/>
  </div>
  <div ref={sentinel} style={{height:20}} aria-hidden="true" />
  {page < pages && <div style={{textAlign:'center',marginTop:12}}>{/* show spinner while more loading */}<Spinner/></div>}

  <BottomNav />
    </div>
  );
}
