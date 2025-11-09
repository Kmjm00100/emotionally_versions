import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import BottomNav from '../components/BottomNav';
import { useLocation } from 'react-router-dom';

export default function ProfilePage(){
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ postsCount: 0, favoriteWriters: 0, favoritedBy: 0 });
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('posts'); // posts | saved | favorites
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const viewingUserId = params.get('user');
  const isOwnProfile = !viewingUserId || (user && viewingUserId === user.userId);
  const BACKEND_ORIGIN = process.env.REACT_APP_API || 'http://127.0.0.1:5000';

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        if (isOwnProfile) {
          // Own profile
          setProfileUser(user);
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const r = await fetch(`${BACKEND_ORIGIN}/api/my-posts?page=1&limit=100`, { headers });
          const data = await r.json();
          setPosts(data.posts || []);
          
          // Fetch favorite writers count
          const favR = await fetch(`${BACKEND_ORIGIN}/api/favorites`, { headers });
          const favData = await favR.json();
          
          setStats({
            postsCount: data.total || (data.posts || []).length,
            favoriteWriters: Array.isArray(favData) ? favData.length : 0,
            favoritedBy: 0 // Will be calculated in backend
          });
        } else {
          // Other user's profile
          const r = await fetch(`${BACKEND_ORIGIN}/api/posts/user/${viewingUserId}`);
          const postsData = await r.json();
          setPosts(Array.isArray(postsData) ? postsData : []);
          
          // Fetch user info
          const userR = await fetch(`${BACKEND_ORIGIN}/api/users/${viewingUserId}`);
          const userData = await userR.json();
          setProfileUser(userData);
          
          // Check if current user has favorited this writer
          if (token) {
            const favCheckR = await fetch(`${BACKEND_ORIGIN}/api/favorites/check/${viewingUserId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const favCheck = await favCheckR.json();
            setIsFavorited(favCheck.isFavorited || false);
          }
          
          setStats({
            postsCount: Array.isArray(postsData) ? postsData.length : 0,
            favoriteWriters: 0,
            favoritedBy: 0 // Will be calculated in backend
          });
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [viewingUserId, user, token, isOwnProfile, BACKEND_ORIGIN]);

  const handleFavorite = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    const targetUserId = viewingUserId || profileUser?._id;
    console.log('Favoriting user:', targetUserId);
    
    if (!targetUserId) {
      console.error('No user ID to favorite');
      return;
    }
    
    try {
      const method = isFavorited ? 'DELETE' : 'POST';
      const url = `${BACKEND_ORIGIN}/api/favorites/${targetUserId}`;
      console.log('Favorite request:', method, url);
      
      const r = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await r.json();
      console.log('Favorite response:', r.status, data);
      
      if (r.ok) {
        setIsFavorited(!isFavorited);
      } else {
        alert(data.error || 'Failed to update favorites');
      }
    } catch (err) {
      console.error('Favorite error:', err);
      alert('Failed to update favorites');
    }
  };

  const handleEditProfile = () => {
    navigate('/profile/edit');
  };

  const handleShare = () => {
    const url = `${window.location.origin}/profile?user=${viewingUserId || user?.userId}`;
    navigator.clipboard.writeText(url);
    alert('Profile link copied to clipboard!');
  };

  return (
    <div className="app">
      <TopBar />
      
      {/* Profile Header */}
      <div style={{
        background: 'var(--card)',
        padding: '24px',
        borderRadius: 'var(--radius)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 20
      }}>
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap'}}>
          {/* Avatar */}
          <div style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: profileUser?.avatar 
              ? `url(${profileUser.avatar})` 
              : 'linear-gradient(135deg, var(--accent), #a855f7)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 'bold',
            color: 'white',
            border: '4px solid var(--accent)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            flexShrink: 0
          }}>
            {!profileUser?.avatar && (profileUser?.username?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?')}
          </div>

          {/* Profile Info */}
          <div style={{flex: 1, minWidth: 250}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap'}}>
              <h2 style={{margin: 0, fontSize: 28}}>
                {profileUser?.username || user?.username || 'Guest'}
              </h2>
              
              {isOwnProfile ? (
                <>
                  <button className="btn secondary" onClick={handleEditProfile} style={{fontSize: 14}}>
                    ⚙️ Edit Profile
                  </button>
                  <button className="btn secondary" onClick={handleShare} style={{fontSize: 14}}>
                    🔗 Share
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className={isFavorited ? "btn" : "btn secondary"} 
                    onClick={handleFavorite}
                    style={{
                      fontSize: 14,
                      background: isFavorited ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : undefined
                    }}
                  >
                    {isFavorited ? '⭐ Favorited' : '⭐ Add to Favorites'}
                  </button>
                  <button className="btn secondary" onClick={handleShare} style={{fontSize: 14}}>
                    🔗 Share
                  </button>
                </>
              )}
            </div>

            {/* Stats */}
            <div style={{display: 'flex', gap: 32, marginBottom: 16}}>
              <div style={{textAlign: 'center'}}>
                <div style={{fontSize: 20, fontWeight: 'bold', color: 'var(--accent)'}}>{stats.postsCount}</div>
                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>posts</div>
              </div>
              {isOwnProfile && (
                <div style={{textAlign: 'center', cursor: 'pointer'}} onClick={() => setTab('favorites')}>
                  <div style={{fontSize: 20, fontWeight: 'bold', color: 'var(--accent)'}}>{stats.favoriteWriters}</div>
                  <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>favorite writers</div>
                </div>
              )}
              {!isOwnProfile && (
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: 20, fontWeight: 'bold', color: 'var(--accent)'}}>{stats.favoritedBy}</div>
                  <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>favorited by</div>
                </div>
              )}
              <div style={{textAlign: 'center'}}>
                <div style={{fontSize: 20, fontWeight: 'bold', color: 'var(--accent)'}}>💗 {profileUser?.hearts || user?.hearts || 0}</div>
                <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>hearts</div>
              </div>
            </div>

            {/* Bio */}
            <div style={{color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5}}>
              <div style={{marginBottom: 4}}>
                <strong style={{color: 'var(--text)'}}>Bio:</strong> Sharing my emotional journey through stories
              </div>
              <div>🌟 Emotional storyteller | 💭 Deep thinker | ❤️ Spreading positivity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        marginBottom: 20
      }}>
        <button 
          onClick={() => setTab('posts')}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            border: 'none',
            borderBottom: tab === 'posts' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'posts' ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          📝 POSTS
        </button>
        {isOwnProfile && (
          <>
            <button 
              onClick={() => setTab('saved')}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === 'saved' ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === 'saved' ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              🔖 SAVED
            </button>
            <button 
              onClick={() => setTab('favorites')}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === 'favorites' ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === 'favorites' ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              ⭐ FAVORITES
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {loading && (
        <div style={{textAlign: 'center', padding: 40}}>
          <div className="spinner" style={{margin: '0 auto'}}></div>
        </div>
      )}

      {!loading && tab === 'posts' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 20
        }}>
          {posts.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 60,
              color: 'var(--text-secondary)'
            }}>
              <div style={{fontSize: 48, marginBottom: 16}}>📝</div>
              <div style={{fontSize: 18, marginBottom: 8}}>No posts yet</div>
              <div style={{fontSize: 14}}>
                {isOwnProfile ? 'Share your first emotional story!' : 'This user hasn\'t posted anything yet.'}
              </div>
            </div>
          ) : (
            posts.map(post => <PostCard key={post._id} post={post} />)
          )}
        </div>
      )}

      {!loading && tab === 'saved' && (
        <div style={{textAlign: 'center', padding: 60, color: 'var(--text-secondary)'}}>
          <div style={{fontSize: 48, marginBottom: 16}}>🔖</div>
          <div style={{fontSize: 18, marginBottom: 8}}>No saved posts</div>
          <div style={{fontSize: 14}}>Save posts to see them here</div>
        </div>
      )}

      {!loading && tab === 'favorites' && <FavoriteWriters token={token} BACKEND_ORIGIN={BACKEND_ORIGIN} />}

      <BottomNav/>
    </div>
  );
}

// Favorite Writers Component
function FavoriteWriters({ token, BACKEND_ORIGIN }) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        const r = await fetch(`${BACKEND_ORIGIN}/api/favorites`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await r.json();
        setFavorites(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Fetch favorites error:', err);
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [token, BACKEND_ORIGIN]);

  const handleRemove = async (userId) => {
    try {
      const r = await fetch(`${BACKEND_ORIGIN}/api/favorites/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (r.ok) {
        setFavorites(favorites.filter(f => f._id !== userId));
      }
    } catch (err) {
      console.error('Remove favorite error:', err);
    }
  };

  if (loading) {
    return (
      <div style={{textAlign: 'center', padding: 40}}>
        <div className="spinner" style={{margin: '0 auto'}}></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div style={{textAlign: 'center', padding: 60, color: 'var(--text-secondary)'}}>
        <div style={{fontSize: 48, marginBottom: 16}}>⭐</div>
        <div style={{fontSize: 18, marginBottom: 8}}>No favorite writers yet</div>
        <div style={{fontSize: 14}}>Discover and favorite writers whose stories resonate with you</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16
    }}>
      {favorites.map(writer => (
        <div 
          key={writer._id}
          style={{
            padding: 20,
            background: 'var(--card)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            transition: 'all 0.2s'
          }}
        >
          <div 
            onClick={() => navigate(`/profile?user=${writer._id}`)}
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: writer.avatar 
                ? `url(${writer.avatar})` 
                : 'linear-gradient(135deg, var(--accent), #a855f7)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 'bold',
              color: 'white',
              border: '3px solid var(--accent)',
              cursor: 'pointer'
            }}
          >
            {!writer.avatar && (writer.username?.[0]?.toUpperCase() || '?')}
          </div>
          
          <div style={{textAlign: 'center', width: '100%'}}>
            <div 
              onClick={() => navigate(`/profile?user=${writer._id}`)}
              style={{
                fontWeight: 600,
                fontSize: 16,
                color: 'var(--accent)',
                marginBottom: 4,
                cursor: 'pointer'
              }}
            >
              @{writer.username}
            </div>
            <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>
              💗 {writer.hearts || 0} Hearts
            </div>
          </div>

          <div style={{display: 'flex', gap: 8, width: '100%'}}>
            <button 
              className="btn secondary"
              onClick={() => navigate(`/profile?user=${writer._id}`)}
              style={{flex: 1, fontSize: 12}}
            >
              View Profile
            </button>
            <button 
              className="btn"
              onClick={() => handleRemove(writer._id)}
              style={{
                flex: 1,
                fontSize: 12,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)'
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
