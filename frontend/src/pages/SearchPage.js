import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import PostCard from '../components/PostCard';
import BottomNav from '../components/BottomNav';
import { useToast } from '../contexts/ToastContext';

export default function SearchPage(){
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState('posts'); // 'posts' or 'users'
  const [q,setQ] = useState('');
  const [results,setResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);
  const [author,setAuthor] = useState('');
  const [tags,setTags] = useState('');
  const [categories,setCategories] = useState('');
  const [language,setLanguage] = useState('');
  const [rarity,setRarity] = useState('');
  const [verified,setVerified] = useState(''); // '', 'true', 'false'
  const [priceMin,setPriceMin] = useState('');
  const [priceMax,setPriceMax] = useState('');
  const [dateFrom,setDateFrom] = useState('');
  const [dateTo,setDateTo] = useState('');
  const [sort,setSort] = useState('relevance');
  const { showToast } = useToast();
  const searchRef = useRef(null);
  const BACKEND_ORIGIN = process.env.REACT_APP_API || 'http://127.0.0.1:5000';
  
  // Live user search suggestions
  useEffect(() => {
    console.log('Search effect triggered:', { searchType, q: q.trim(), length: q.trim().length });
    
    if (searchType !== 'users' || q.trim().length < 1) {
      setUserResults([]);
      setShowSuggestions(false);
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        const url = `${BACKEND_ORIGIN}/api/users/search?q=${encodeURIComponent(q)}&limit=8`;
        console.log('Fetching users from:', url);
        
        const r = await fetch(url);
        console.log('Response status:', r.status);
        
        const d = await r.json();
        console.log('User results:', d);
        
        setUserResults(d);
        setShowSuggestions(true);
      } catch (e) {
        console.error('User search error:', e);
      }
    }, 300); // Debounce 300ms
    
    return () => clearTimeout(timer);
  }, [q, searchType, BACKEND_ORIGIN]);
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const run = async()=>{
    if (searchType === 'users') {
      // Just show the suggestions results
      setShowSuggestions(false);
      return;
    }
    
    try{
      const params = new URLSearchParams();
      if(q) params.set('q', q);
      if(author) params.set('author', author);
      if(tags) params.set('tags', tags);
      if(categories) params.set('categories', categories);
      if(language) params.set('language', language);
      if(rarity) params.set('rarity', rarity);
      if(verified) params.set('verified', verified);
      if(priceMin) params.set('priceMin', priceMin);
      if(priceMax) params.set('priceMax', priceMax);
      if(dateFrom) params.set('dateFrom', dateFrom);
      if(dateTo) params.set('dateTo', dateTo);
      if(sort) params.set('sort', sort);
      const r = await fetch(`${BACKEND_ORIGIN}/api/search?${params.toString()}`);
      const d = await r.json(); setResults(d);
    }catch(e){ showToast('Search failed','error') }
  };
  const saveSearch = ()=>{
    const storeKey = 'emo_saved_searches';
    const existing = JSON.parse(localStorage.getItem(storeKey) || '[]');
    const entry = { name: q || 'Search', q, author, tags, categories, language, rarity, verified, priceMin, priceMax, dateFrom, dateTo, sort, ts: Date.now() };
    localStorage.setItem(storeKey, JSON.stringify([entry, ...existing].slice(0,20)));
    showToast('Search saved','success');
  };
  
  const handleUserClick = (userId) => {
    setShowSuggestions(false);
    navigate(`/profile?user=${userId}`);
  };
  
  return (
    <div className="app">
      <TopBar />
      <h2>Search</h2>
      
      {/* Search Type Toggle */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button 
          className={searchType === 'posts' ? 'btn' : 'btn secondary'} 
          onClick={() => { setSearchType('posts'); setQ(''); setUserResults([]); }}
        >
          📝 Posts
        </button>
        <button 
          className={searchType === 'users' ? 'btn' : 'btn secondary'} 
          onClick={() => { setSearchType('users'); setQ(''); setResults([]); }}
        >
          👤 Users
        </button>
      </div>
      
      <div className="form" style={{background:'var(--card)',padding:14,borderRadius:'var(--radius)',border:'1px solid rgba(255,255,255,0.04)',position:'relative'}} ref={searchRef}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200,position:'relative'}}>
            <input 
              value={q} 
              onChange={e=>setQ(e.target.value)} 
              onFocus={() => searchType === 'users' && userResults.length > 0 && setShowSuggestions(true)}
              placeholder={searchType === 'posts' ? "Title, content, tags..." : "Search users by username..."}
              style={{width:'100%'}}
            />
            
            {/* User Suggestions Dropdown */}
            {searchType === 'users' && showSuggestions && userResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'var(--bg-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius)',
                maxHeight: 400,
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                {userResults.map(user => (
                  <div 
                    key={user._id}
                    onClick={() => handleUserClick(user._id)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: user.avatar ? `url(${user.avatar})` : 'var(--accent)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: 18
                    }}>
                      {!user.avatar && (user.username?.[0]?.toUpperCase() || '?')}
                    </div>
                    <div style={{flex: 1}}>
                      <div style={{fontWeight: 600, color: 'var(--accent)'}}>@{user.username}</div>
                      <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>💗 {user.hearts || 0} Hearts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {searchType === 'posts' && <button className="btn" onClick={run}>Search</button>}
          {searchType === 'posts' && <button className="btn secondary" onClick={()=> setOpenFilters(v=>!v)} aria-expanded={openFilters}>Filters</button>}
          {searchType === 'posts' && <button className="btn secondary" onClick={saveSearch}>Save Search</button>}
        </div>
        {searchType === 'posts' && openFilters && (
          <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',gap:10}}>
            <input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Author"/>
            <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="Tags (comma separated)"/>
            <input value={categories} onChange={e=>setCategories(e.target.value)} placeholder="Categories"/>
            <input value={language} onChange={e=>setLanguage(e.target.value)} placeholder="Language"/>
            <select value={rarity} onChange={e=>setRarity(e.target.value)}>
              <option value="">Rarity</option>
              <option>Common</option>
              <option>Rare</option>
              <option>Legendary</option>
            </select>
            <select value={verified} onChange={e=>setVerified(e.target.value)}>
              <option value="">Verification</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
            <input type="number" value={priceMin} onChange={e=>setPriceMin(e.target.value)} placeholder="Min hearts"/>
            <input type="number" value={priceMax} onChange={e=>setPriceMax(e.target.value)} placeholder="Max hearts"/>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} placeholder="From"/>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} placeholder="To"/>
            <select value={sort} onChange={e=>setSort(e.target.value)}>
              <option value="relevance">Sort: Relevance</option>
              <option value="trending">Sort: Trending</option>
              <option value="price">Sort: Price</option>
              <option value="new">Sort: New</option>
            </select>
          </div>
        )}
      </div>
      
      {/* Results Section */}
      {searchType === 'posts' && (
        <div style={{marginTop:12}}>
          {results.length === 0 && q && <div style={{textAlign:'center',color:'var(--text-secondary)',padding:40}}>No posts found</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:20}}>
            {results.map(post=> (
              <div key={post._id}>
                <PostCard post={post} />
                {post._highlight && <div className="tiny" style={{marginTop:6,color:'var(--muted)'}}>…{post._highlight}…</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {searchType === 'users' && userResults.length > 0 && !showSuggestions && (
        <div style={{marginTop:12}}>
          <h3>Search Results</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {userResults.map(user => (
              <div 
                key={user._id}
                onClick={() => handleUserClick(user._id)}
                style={{
                  padding: 16,
                  background: 'var(--card)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--card)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: user.avatar ? `url(${user.avatar})` : 'var(--accent)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 24,
                  flexShrink: 0
                }}>
                  {!user.avatar && (user.username?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 600, fontSize: 18, color: 'var(--accent)', marginBottom: 4}}>@{user.username}</div>
                  <div style={{fontSize: 14, color: 'var(--text-secondary)'}}>💗 {user.hearts || 0} Hearts</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <BottomNav/>
    </div>
  );
}
