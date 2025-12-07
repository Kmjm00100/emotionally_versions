import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Spinner from '../components/Spinner';

import { API_URL } from '../config';

export default function RewardsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'leaderboard', 'badges'
  const [rewards, setRewards] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardType, setLeaderboardType] = useState('karma');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchRewards();
    fetchLeaderboard();
  }, [token, navigate]);

  const fetchRewards = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rewards/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setRewards(data);
      }
    } catch (error) {
      console.error('Fetch rewards error:', error);
    }
  };

  const fetchLeaderboard = async (type = 'karma') => {
    try {
      const res = await fetch(`${API_URL}/api/rewards/leaderboard?type=${type}&limit=10`);
      const data = await res.json();
      if (res.ok) {
        setLeaderboard(data.users);
        setLeaderboardType(type);
      }
    } catch (error) {
      console.error('Fetch leaderboard error:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getBadgesByCategory = (badges) => {
    const categories = {};
    badges.forEach(badge => {
      if (!categories[badge.category]) {
        categories[badge.category] = [];
      }
      categories[badge.category].push(badge);
    });
    return categories;
  };

  const getRankColor = (position) => {
    if (position === 1) return '#FFD700'; // Gold
    if (position === 2) return '#C0C0C0'; // Silver
    if (position === 3) return '#CD7F32'; // Bronze
    return '#666';
  };

  if (loading || !rewards) {
    return (
      <div className="page">
        <TopBar title="Rewards" showBack={false} />
        <Spinner />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar title="🏆 Rewards" showBack={false} />
      
      <div className="content">
        {/* Tab Navigation */}
        <div className="tab-nav">
          <button 
            className={view === 'dashboard' ? 'tab active' : 'tab'}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={view === 'badges' ? 'tab active' : 'tab'}
            onClick={() => setView('badges')}
          >
            Badges
          </button>
          <button 
            className={view === 'leaderboard' ? 'tab active' : 'tab'}
            onClick={() => setView('leaderboard')}
          >
            Leaderboard
          </button>
        </div>

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="rewards-dashboard">
            {/* User Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card hearts">
                <div className="stat-icon">💖</div>
                <div className="stat-content">
                  <div className="stat-value">{rewards.user.hearts}</div>
                  <div className="stat-label">Hearts</div>
                </div>
              </div>
              
              <div className="stat-card karma">
                <div className="stat-icon">🌟</div>
                <div className="stat-content">
                  <div className="stat-value">{rewards.user.karma}</div>
                  <div className="stat-label">Karma</div>
                </div>
              </div>
              
              <div className="stat-card level">
                <div className="stat-icon">⚡</div>
                <div className="stat-content">
                  <div className="stat-value">{rewards.user.level}</div>
                  <div className="stat-label">Level</div>
                </div>
              </div>
              
              <div className="stat-card position">
                <div className="stat-icon">🎖️</div>
                <div className="stat-content">
                  <div className="stat-value">#{rewards.user.leaderboardPosition}</div>
                  <div className="stat-label">Rank</div>
                </div>
              </div>
            </div>

            {/* Level Progress */}
            <div className="level-progress-card">
              <div className="level-header">
                <h3>Level {rewards.user.level} Progress</h3>
                <span className="experience">{rewards.user.experience} XP</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill level-progress" 
                  style={{ width: `${rewards.user.progressToNext}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {Math.round(rewards.user.progressToNext)}% to Level {rewards.user.level + 1}
              </div>
            </div>

            {/* Trade Stats */}
            <div className="trade-stats-card">
              <h3>Trading Statistics</h3>
              <div className="trade-stats-grid">
                <div className="trade-stat">
                  <span className="trade-stat-value">{rewards.user.tradeStats.completed}</span>
                  <span className="trade-stat-label">Trades Completed</span>
                </div>
                <div className="trade-stat">
                  <span className="trade-stat-value">{rewards.user.tradeStats.rating.toFixed(1)} ⭐</span>
                  <span className="trade-stat-label">Rating</span>
                </div>
                <div className="trade-stat">
                  <span className="trade-stat-value">{rewards.user.tradeStats.successRate}%</span>
                  <span className="trade-stat-label">Success Rate</span>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            {rewards.recentTransactions.length > 0 && (
              <div className="recent-transactions">
                <h3>Recent Activity</h3>
                <div className="transactions-list">
                  {rewards.recentTransactions.map((transaction, index) => (
                    <div key={index} className="transaction-item">
                      <div className="transaction-icon">
                        {transaction.type === 'hearts_earned' && '💖'}
                        {transaction.type === 'karma_earned' && '🌟'}
                        {transaction.type === 'experience_gained' && '⚡'}
                        {transaction.type === 'badge_earned' && '🏆'}
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-description">{transaction.description}</div>
                        <div className="transaction-date">{formatDate(transaction.createdAt)}</div>
                      </div>
                      <div className="transaction-amount">
                        +{transaction.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badges View */}
        {view === 'badges' && (
          <div className="badges-view">
            {rewards.user.badges.length === 0 ? (
              <div className="empty-state">
                <h3>🏆 No Badges Yet</h3>
                <p>Start creating posts, trading, and engaging with the community to earn badges!</p>
              </div>
            ) : (
              <div className="badges-container">
                {Object.entries(getBadgesByCategory(rewards.user.badges)).map(([category, badges]) => (
                  <div key={category} className="badge-category">
                    <h3 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)} Badges</h3>
                    <div className="badges-grid">
                      {badges.map((badge, index) => (
                        <div key={index} className="badge-card">
                          <div className="badge-icon">{badge.icon}</div>
                          <div className="badge-name">{badge.name}</div>
                          <div className="badge-description">{badge.description}</div>
                          <div className="badge-date">Earned {formatDate(badge.earnedAt)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard View */}
        {view === 'leaderboard' && (
          <div className="leaderboard-view">
            <div className="leaderboard-controls">
              <h3>Community Leaderboard</h3>
              <select 
                value={leaderboardType} 
                onChange={(e) => {
                  setLeaderboardType(e.target.value);
                  fetchLeaderboard(e.target.value);
                }}
                className="leaderboard-select"
              >
                <option value="karma">Karma Leaders</option>
                <option value="level">Highest Levels</option>
                <option value="hearts">Most Hearts</option>
                <option value="trades">Top Traders</option>
              </select>
            </div>

            <div className="leaderboard-list">
              {leaderboard.map((user, index) => (
                <div key={user._id} className="leaderboard-item">
                  <div className="rank" style={{ color: getRankColor(index + 1) }}>
                    #{index + 1}
                  </div>
                  <div className="user-info">
                    <div className="username">{user.username}</div>
                    <div className="user-stats">
                      Level {user.level} • {user.badges?.length || 0} badges
                    </div>
                  </div>
                  <div className="leaderboard-value">
                    {leaderboardType === 'karma' && `${user.karma} karma`}
                    {leaderboardType === 'level' && `Level ${user.level}`}
                    {leaderboardType === 'hearts' && `${user.hearts} hearts`}
                    {leaderboardType === 'trades' && `${user.tradeStats.completed} trades`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}