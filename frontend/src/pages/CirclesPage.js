import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_URL } from '../config';

export default function CirclesPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();
  const [circles, setCircles] = useState([]);
  const [myCircles, setMyCircles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCircles();
  }, [token]);

  const fetchCircles = async () => {
    try {
      setLoading(true);
      // Get all circles
      const circlesRes = await fetch(`${API_URL}/api/circles`);
      const circlesData = await circlesRes.json();
      setCircles(circlesData);

      // Get user's joined circles if logged in
      if (token) {
        const myCirclesRes = await fetch(`${API_URL}/api/my-circles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (myCirclesRes.ok) {
          const myCirclesData = await myCirclesRes.json();
          setMyCircles(myCirclesData.map(c => c._id));
        }
      }
    } catch (err) {
      console.error('Fetch circles error:', err);
      showToast('Failed to load circles', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeave = async (slug, circleId, isJoined) => {
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
        // Update local state
        if (isJoined) {
          setMyCircles(myCircles.filter(id => id !== circleId));
        } else {
          setMyCircles([...myCircles, circleId]);
        }
        fetchCircles(); // Refresh to update member counts
      } else {
        const data = await res.json();
        showToast(data.error || 'Action failed', 'error');
      }
    } catch (err) {
      console.error('Join/Leave error:', err);
      showToast('Network error', 'error');
    }
  };

  return (
    <div className="app">
      <TopBar />
      <main className="main-content">
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
          <header style={{ marginBottom: '30px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' }}>
              Support Circles
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
              Join anonymous communities where you can share your emotions safely. 
              Posts in circles are temporary and disappear after 7 days.
            </p>
          </header>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner"></div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {circles.map(circle => {
                const isJoined = myCircles.includes(circle._id);
                return (
                  <div
                    key={circle._id}
                    style={{
                      background: 'var(--card-bg)',
                      borderRadius: '12px',
                      padding: '24px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onClick={() => navigate(`/circles/${circle.slug}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        fontSize: '48px',
                        width: '80px',
                        height: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${circle.color}20`,
                        borderRadius: '16px',
                        flexShrink: 0,
                      }}
                    >
                      {circle.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                        {circle.name}
                      </h2>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>
                        {circle.description}
                      </p>
                      <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>👥 {circle.memberCount} members</span>
                        <span>📝 {circle.postCount} posts</span>
                      </div>
                    </div>

                    {/* Join/Leave Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinLeave(circle.slug, circle._id, isJoined);
                      }}
                      style={{
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: isJoined ? '2px solid var(--accent-color)' : 'none',
                        background: isJoined ? 'transparent' : circle.color,
                        color: isJoined ? 'var(--accent-color)' : 'white',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'opacity 0.2s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      {isJoined ? 'Joined ✓' : 'Join'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
