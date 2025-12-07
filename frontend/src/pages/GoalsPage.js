import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Spinner from '../components/Spinner';

import { API_URL } from '../config';

const goalCategories = [
  { value: 'mood_improvement', label: 'Mood Improvement', emoji: '😊', color: '#34D399' },
  { value: 'stress_reduction', label: 'Stress Reduction', emoji: '😌', color: '#60A5FA' },
  { value: 'social_connection', label: 'Social Connection', emoji: '👥', color: '#FB923C' },
  { value: 'self_care', label: 'Self Care', emoji: '💝', color: '#F472B6' },
  { value: 'emotional_awareness', label: 'Emotional Awareness', emoji: '🧠', color: '#A78BFA' },
  { value: 'coping_skills', label: 'Coping Skills', emoji: '💪', color: '#FCD34D' },
  { value: 'other', label: 'Other', emoji: '🎯', color: '#9CA3AF' }
];

const targetTypes = [
  { value: 'daily_habit', label: 'Daily Habit', description: 'Something to do every day' },
  { value: 'weekly_target', label: 'Weekly Target', description: 'A goal to reach each week' },
  { value: 'milestone', label: 'Milestone', description: 'A one-time achievement' },
  { value: 'streak', label: 'Streak', description: 'Consecutive days of activity' }
];

const priorityLevels = [
  { value: 'low', label: 'Low', color: '#9CA3AF' },
  { value: 'medium', label: 'Medium', color: '#FB923C' },
  { value: 'high', label: 'High', color: '#EF4444' }
];

export default function GoalsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState([]);
  const [view, setView] = useState('list'); // 'list', 'create', 'stats'
  const [stats, setStats] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Create goal form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('medium');

  // Progress form states
  const [progressValue, setProgressValue] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchGoals();
    fetchStats();
  }, [token, navigate]);

  const fetchGoals = async () => {
    try {
      const res = await fetch(`${API_URL}/api/goals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGoals(data);
      }
    } catch (error) {
      console.error('Fetch goals error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/goals/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const createGoal = async (e) => {
    e.preventDefault();
    if (!title.trim() || !category || !targetType) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating goal with token:', token ? 'Token exists' : 'No token');
      console.log('Goal data:', {
        title: title.trim(),
        description: description.trim(),
        category,
        targetType,
        targetValue: targetValue ? parseInt(targetValue) : undefined,
        targetUnit: targetUnit.trim(),
        deadline: deadline || undefined,
        priority
      });
      
      const res = await fetch(`${API_URL}/api/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          targetType,
          targetValue: targetValue ? parseInt(targetValue) : undefined,
          targetUnit: targetUnit.trim(),
          deadline: deadline || undefined,
          priority
        })
      });

      console.log('Response status:', res.status);
      console.log('Response ok:', res.ok);

      if (res.ok) {
        // Reset form
        setTitle('');
        setDescription('');
        setCategory('');
        setTargetType('');
        setTargetValue('');
        setTargetUnit('');
        setDeadline('');
        setPriority('medium');
        
        // Refresh goals and switch to list view
        await fetchGoals();
        await fetchStats();
        setView('list');
      } else {
        const error = await res.json();
        console.error('Server error:', error);
        alert(error.error || 'Failed to create goal');
      }
    } catch (error) {
      console.error('Create goal error:', error);
      console.error('Error details:', error.message);
      alert('Failed to create goal');
    } finally {
      setLoading(false);
    }
  };

  const addProgress = async (goalId) => {
    if (!progressValue || progressValue <= 0) {
      alert('Please enter a valid progress value');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/goals/${goalId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          progressValue: parseInt(progressValue),
          note: progressNote.trim(),
          date: new Date().toISOString()
        })
      });

      if (res.ok) {
        setProgressValue('');
        setProgressNote('');
        setShowProgressModal(false);
        setSelectedGoal(null);
        await fetchGoals();
        await fetchStats();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to add progress');
      }
    } catch (error) {
      console.error('Add progress error:', error);
      alert('Failed to add progress');
    } finally {
      setLoading(false);
    }
  };

  const deleteGoal = async (goalId) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const res = await fetch(`${API_URL}/api/goals/${goalId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchGoals();
        await fetchStats();
      }
    } catch (error) {
      console.error('Delete goal error:', error);
    }
  };

  const getCategoryInfo = (categoryValue) => {
    return goalCategories.find(cat => cat.value === categoryValue) || goalCategories[6];
  };

  const getTargetTypeInfo = (targetTypeValue) => {
    return targetTypes.find(type => type.value === targetTypeValue) || targetTypes[0];
  };

  const getPriorityInfo = (priorityValue) => {
    return priorityLevels.find(p => p.value === priorityValue) || priorityLevels[1];
  };

  const getProgressPercentage = (goal) => {
    if (!goal.targetValue || goal.targetValue === 0) return 0;
    return Math.min(100, Math.round((goal.currentProgress / goal.targetValue) * 100));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading || !token) {
    return (
      <div className="page">
        <TopBar title="Goals" showBack={false} />
        <Spinner />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar title="🎯 Goals" showBack={false} />
      
      <div className="content">
        {/* Tab Navigation */}
        <div className="tab-nav">
          <button 
            className={view === 'list' ? 'tab active' : 'tab'}
            onClick={() => setView('list')}
          >
            My Goals
          </button>
          <button 
            className={view === 'create' ? 'tab active' : 'tab'}
            onClick={() => setView('create')}
          >
            Create Goal
          </button>
          <button 
            className={view === 'stats' ? 'tab active' : 'tab'}
            onClick={() => setView('stats')}
          >
            Statistics
          </button>
        </div>

        {/* Goals List View */}
        {view === 'list' && (
          <div className="goals-list">
            {goals.length === 0 ? (
              <div className="empty-state">
                <h3>🎯 No Goals Yet</h3>
                <p>Start your wellness journey by creating your first goal!</p>
                <button 
                  className="btn primary" 
                  onClick={() => setView('create')}
                >
                  Create Your First Goal
                </button>
              </div>
            ) : (
              <div className="goals-grid">
                {goals.map(goal => {
                  const categoryInfo = getCategoryInfo(goal.category);
                  const priorityInfo = getPriorityInfo(goal.priority);
                  const progressPercent = getProgressPercentage(goal);
                  
                  return (
                    <div key={goal._id} className="goal-card">
                      <div className="goal-header">
                        <div className="goal-category">
                          <span className="category-emoji">{categoryInfo.emoji}</span>
                          <span className="category-name">{categoryInfo.label}</span>
                        </div>
                        <div className="goal-actions">
                          <button 
                            className="btn small primary"
                            onClick={() => {
                              setSelectedGoal(goal);
                              setShowProgressModal(true);
                            }}
                            disabled={goal.status === 'completed'}
                          >
                            + Progress
                          </button>
                          <button 
                            className="btn small danger"
                            onClick={() => deleteGoal(goal._id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <h3 className="goal-title">{goal.title}</h3>
                      
                      {goal.description && (
                        <p className="goal-description">{goal.description}</p>
                      )}

                      <div className="goal-details">
                        <div className="goal-type">
                          <strong>Type:</strong> {getTargetTypeInfo(goal.targetType).label}
                        </div>
                        
                        {goal.targetValue && (
                          <div className="goal-target">
                            <strong>Target:</strong> {goal.targetValue} {goal.targetUnit}
                          </div>
                        )}

                        <div className="goal-priority">
                          <strong>Priority:</strong> 
                          <span 
                            className="priority-badge" 
                            style={{ backgroundColor: priorityInfo.color }}
                          >
                            {priorityInfo.label}
                          </span>
                        </div>

                        {goal.deadline && (
                          <div className="goal-deadline">
                            <strong>Deadline:</strong> {formatDate(goal.deadline)}
                          </div>
                        )}
                      </div>

                      {goal.targetValue && (
                        <div className="progress-section">
                          <div className="progress-info">
                            <span>Progress: {goal.currentProgress} / {goal.targetValue}</span>
                            <span>{progressPercent}%</span>
                          </div>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <div className="goal-status">
                        <span className={`status-badge ${goal.status}`}>
                          {goal.status === 'completed' && '✅ '}
                          {goal.status === 'active' && '🔄 '}
                          {goal.status === 'paused' && '⏸️ '}
                          {goal.status === 'abandoned' && '❌ '}
                          {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create Goal View */}
        {view === 'create' && (
          <form onSubmit={createGoal} className="create-goal-form">
            <h2>✨ Create New Goal</h2>
            
            <div className="form-group">
              <label>Goal Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Practice mindfulness daily"
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your goal in detail..."
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <div className="category-grid">
                {goalCategories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`category-option ${category === cat.value ? 'selected' : ''}`}
                    onClick={() => setCategory(cat.value)}
                    style={{ borderColor: category === cat.value ? cat.color : '#ddd' }}
                  >
                    <span className="category-emoji">{cat.emoji}</span>
                    <span className="category-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Target Type *</label>
              <div className="target-type-grid">
                {targetTypes.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    className={`target-type-option ${targetType === type.value ? 'selected' : ''}`}
                    onClick={() => setTargetType(type.value)}
                  >
                    <strong>{type.label}</strong>
                    <p>{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Target Value</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g., 7"
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input
                  type="text"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder="e.g., days, sessions"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <div className="priority-options">
                {priorityLevels.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={`priority-option ${priority === p.value ? 'selected' : ''}`}
                    onClick={() => setPriority(p.value)}
                    style={{ 
                      backgroundColor: priority === p.value ? p.color : 'transparent',
                      color: priority === p.value ? 'white' : p.color,
                      borderColor: p.color
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Deadline (Optional)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <button type="submit" className="btn primary large">
              Create Goal
            </button>
          </form>
        )}

        {/* Statistics View */}
        {view === 'stats' && stats && (
          <div className="stats-view">
            <h2>📊 Your Progress</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{stats.totalGoals}</div>
                <div className="stat-label">Total Goals</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.completedGoals}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.activeGoals}</div>
                <div className="stat-label">Active</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.completionRate}%</div>
                <div className="stat-label">Success Rate</div>
              </div>
            </div>

            {stats.recentProgress && stats.recentProgress.length > 0 && (
              <div className="recent-progress">
                <h3>Recent Progress</h3>
                <div className="progress-list">
                  {stats.recentProgress.map((progress, index) => (
                    <div key={index} className="progress-item">
                      <div className="progress-goal">{progress.goalId?.title}</div>
                      <div className="progress-details">
                        <span>+{progress.progressValue}</span>
                        <span>{new Date(progress.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Modal */}
        {showProgressModal && selectedGoal && (
          <div className="modal-overlay" onClick={() => setShowProgressModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Add Progress to: {selectedGoal.title}</h3>
              
              <div className="form-group">
                <label>Progress Value *</label>
                <input
                  type="number"
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  placeholder="How much progress did you make?"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Note (Optional)</label>
                <textarea
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Add a note about your progress..."
                  maxLength={300}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="btn secondary" 
                  onClick={() => setShowProgressModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn primary" 
                  onClick={() => addProgress(selectedGoal._id)}
                >
                  Add Progress
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}