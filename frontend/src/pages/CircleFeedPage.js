import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import PostCard from '../components/PostCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_URL } from '../config';

export default function CircleFeedPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();
  const [circle, setCircle] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    fetchCircleData();
  }, [slug, token]);

  const fetchCircleData = async () => {
    try {
      setLoading(true);
      
      // Get circle info
      const circleRes = await fetch(`${API_URL}/api/circles/${slug}`);
      if (!circleRes.ok) {
        showToast('Circle not found', 'error');
        navigate('/circles');
        return;
      }
      const circleData = await circleRes.json();
      setCircle(circleData);

      // Get circle posts
      const postsRes = await fetch(`${API_URL}/api/circles/${slug}/posts`);
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData.posts || []);
      }

      // Check if user has joined this circle
      if (token) {
        const myCirclesRes = await fetch(`${API_URL}/api/my-circles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (myCirclesRes.ok) {
          const myCircles = await myCirclesRes.json();
          setIsJoined(myCircles.some(c => c._id === circleData._id));
        }
      }
    } catch (err) {
      console.error('Fetch circle error:', err);
      showToast('Failed to load circle', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeave = async () => {
    if (!token) {
      showToast('Please login to join circles', 'error');
      return;
    }

    try {
      const endpoint = isJoined ? 'leave' : 'join';
      const res = await fetch(`${API_URL}/api/circles/${slug}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast(isJoined ? 'Left circle' : 'Joined circle', 'success');
        setIsJoined(!isJoined);
        fetchCircleData(); // Refresh data
      } else {
        const data = await res.json();
        showToast(data.error || 'Action failed', 'error');
      }
    } catch (err) {
      console.error('Join/Leave error:', err);
      showToast('Network error', 'error');
    }
  };

  const handlePostToCircle = () => {
    if (!token) {
      showToast('Please login to post', 'error');
      return;
    }
    if (!isJoined) {
      showToast('Join the circle to post', 'error');
      return;
    }
    navigate(`/write?circle=${slug}`);
  };

  if (loading) {
    return (
      <div className="app">
        <TopBar />
        <main className="main-content">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner"></div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!circle) {
    return null;
  }

  return (
    <div className="app">
      <TopBar />
      <main className="main-content">
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          {/* Circle Header */}
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: '16px',
              padding: '30px',
              marginBottom: '30px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '60px',
                  width: '100px',
                  height: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${circle.color}20`,
                  borderRadius: '20px',
                }}
              >
                {circle.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {circle.name}
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {circle.description}
                </p>
                <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <span>👥 {circle.memberCount} members</span>
                  <span>📝 {circle.postCount} posts</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleJoinLeave}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '8px',
                  border: isJoined ? '2px solid var(--accent-color)' : 'none',
                  background: isJoined ? 'transparent' : circle.color,
                  color: isJoined ? 'var(--accent-color)' : 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                {isJoined ? 'Joined ✓' : 'Join Circle'}
              </button>
              {isJoined && (
                <button
                  onClick={handlePostToCircle}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent-color)',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '15px',
                  }}
                >
                  ✍️ Post Anonymously
                </button>
              )}
            </div>

            {isJoined && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: `${circle.color}10`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                🔒 Posts in this circle are anonymous and will auto-delete after 7 days
              </div>
            )}
          </div>

          {/* Posts Feed */}
          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💭</div>
              <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                No posts yet
              </p>
              <p style={{ fontSize: '14px' }}>
                Be the first to share your story in this circle
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {posts.map(post => (
                <PostCard key={post._id} post={post} />
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
