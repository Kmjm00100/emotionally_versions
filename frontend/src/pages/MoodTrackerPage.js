import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Spinner from '../components/Spinner';

const API_URL = 'https://emotionally-versions.onrender.com';

const moods = [
  { value: 'happy', emoji: '😊', label: 'Happy', color: '#FCD34D' },
  { value: 'neutral', emoji: '😐', label: 'Neutral', color: '#9CA3AF' },
  { value: 'sad', emoji: '😢', label: 'Sad', color: '#60A5FA' },
  { value: 'anxious', emoji: '😰', label: 'Anxious', color: '#A78BFA' },
  { value: 'angry', emoji: '😡', label: 'Angry', color: '#F87171' },
  { value: 'excited', emoji: '🤩', label: 'Excited', color: '#FB923C' },
  { value: 'peaceful', emoji: '😌', label: 'Peaceful', color: '#34D399' },
  { value: 'overwhelmed', emoji: '😵', label: 'Overwhelmed', color: '#EF4444' }
];

export default function MoodTrackerPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedMood, setSelectedMood] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [note, setNote] = useState('');
  const [moodHistory, setMoodHistory] = useState([]);
  const [aiInsight, setAiInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [view, setView] = useState('track'); // 'track' or 'history'

  useEffect(() => {
    fetchMoodHistory();
  }, []);

  const fetchMoodHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/moods?days=30`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMoodHistory(data.moods || []);
      }
    } catch (error) {
      console.error('Fetch moods error:', error);
    }
  };

  const fetchInsights = async () => {
    try {
      setInsightLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/moods/insights`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAiInsight(data.insight);
      }
    } catch (error) {
      console.error('Fetch insights error:', error);
    } finally {
      setInsightLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMood) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/moods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mood: selectedMood,
          intensity,
          note
        })
      });

      if (res.ok) {
        // Reset form
        setSelectedMood('');
        setIntensity(5);
        setNote('');
        // Refresh history
        await fetchMoodHistory();
        alert('✨ Mood logged successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to log mood');
      }
    } catch (error) {
      console.error('Log mood error:', error);
      alert('Failed to log mood');
    } finally {
      setLoading(false);
    }
  };

  const getMoodColor = (moodValue) => {
    const mood = moods.find(m => m.value === moodValue);
    return mood ? mood.color : '#9CA3AF';
  };

  const getMoodEmoji = (moodValue) => {
    const mood = moods.find(m => m.value === moodValue);
    return mood ? mood.emoji : '😐';
  };

  return (
    <div style={{ paddingTop: '60px', paddingBottom: '80px', minHeight: '100vh', backgroundColor: '#0F172A' }}>
      <TopBar />
      
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ color: '#F1F5F9', fontSize: '28px', fontWeight: 'bold', marginBottom: '10px' }}>
          🧠 Mood Tracker
        </h1>
        <p style={{ color: '#94A3B8', marginBottom: '20px' }}>
          Track your emotional journey and gain AI-powered insights
        </p>

        {/* View Toggle */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setView('track')}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: view === 'track' ? '#8B5CF6' : '#1E293B',
              color: '#F1F5F9',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: view === 'track' ? 'bold' : 'normal'
            }}
          >
            📝 Track Mood
          </button>
          <button
            onClick={() => setView('history')}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: view === 'history' ? '#8B5CF6' : '#1E293B',
              color: '#F1F5F9',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: view === 'history' ? 'bold' : 'normal'
            }}
          >
            📊 History
          </button>
        </div>

        {view === 'track' ? (
          /* TRACK MOOD VIEW */
          <div>
            <form onSubmit={handleSubmit}>
              {/* Mood Selector */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', color: '#F1F5F9', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold' }}>
                  How are you feeling?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {moods.map(mood => (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => setSelectedMood(mood.value)}
                      style={{
                        padding: '15px',
                        backgroundColor: selectedMood === mood.value ? mood.color : '#1E293B',
                        border: selectedMood === mood.value ? `3px solid ${mood.color}` : '2px solid #334155',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        transform: selectedMood === mood.value ? 'scale(1.05)' : 'scale(1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontSize: '32px' }}>{mood.emoji}</span>
                      <span style={{ fontSize: '12px', color: '#F1F5F9', fontWeight: selectedMood === mood.value ? 'bold' : 'normal' }}>
                        {mood.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensity Slider */}
              {selectedMood && (
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', color: '#F1F5F9', marginBottom: '10px', fontSize: '16px' }}>
                    Intensity: {intensity}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={intensity}
                    onChange={(e) => setIntensity(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '5px',
                      background: `linear-gradient(to right, ${getMoodColor(selectedMood)} 0%, ${getMoodColor(selectedMood)} ${intensity * 10}%, #334155 ${intensity * 10}%, #334155 100%)`,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '12px', marginTop: '5px' }}>
                    <span>Mild</span>
                    <span>Intense</span>
                  </div>
                </div>
              )}

              {/* Note */}
              {selectedMood && (
                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', color: '#F1F5F9', marginBottom: '10px', fontSize: '16px' }}>
                    Add a note (optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What's on your mind?"
                    maxLength={500}
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '12px',
                      backgroundColor: '#1E293B',
                      border: '2px solid #334155',
                      borderRadius: '12px',
                      color: '#F1F5F9',
                      fontSize: '14px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ color: '#64748B', fontSize: '12px', marginTop: '5px', textAlign: 'right' }}>
                    {note.length}/500
                  </div>
                </div>
              )}

              {/* Submit Button */}
              {selectedMood && (
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '15px',
                    backgroundColor: getMoodColor(selectedMood),
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Logging...' : '✨ Log Mood'}
                </button>
              )}
            </form>
          </div>
        ) : (
          /* HISTORY VIEW */
          <div>
            {/* AI Insights */}
            <div style={{
              backgroundColor: '#1E293B',
              border: '2px solid #8B5CF6',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 'bold' }}>
                  🤖 AI Insights
                </h3>
                <button
                  onClick={fetchInsights}
                  disabled={insightLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#8B5CF6',
                    color: '#F1F5F9',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: insightLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: insightLoading ? 0.7 : 1
                  }}
                >
                  {insightLoading ? 'Analyzing...' : 'Generate'}
                </button>
              </div>
              {aiInsight ? (
                <p style={{ color: '#CBD5E1', fontSize: '14px', lineHeight: '1.6' }}>
                  {aiInsight}
                </p>
              ) : (
                <p style={{ color: '#64748B', fontSize: '14px', fontStyle: 'italic' }}>
                  Click "Generate" to get AI-powered insights about your mood patterns
                </p>
              )}
            </div>

            {/* Mood History */}
            <div>
              <h3 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                📅 Last 30 Days ({moodHistory.length} entries)
              </h3>
              
              {moodHistory.length === 0 ? (
                <div style={{
                  backgroundColor: '#1E293B',
                  borderRadius: '12px',
                  padding: '40px',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#64748B', fontSize: '16px' }}>
                    No mood entries yet. Start tracking to see your history!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {moodHistory.map((entry, index) => (
                    <div
                      key={entry._id || index}
                      style={{
                        backgroundColor: '#1E293B',
                        borderRadius: '12px',
                        padding: '15px',
                        borderLeft: `5px solid ${getMoodColor(entry.mood)}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '28px' }}>{getMoodEmoji(entry.mood)}</span>
                          <div>
                            <div style={{ color: '#F1F5F9', fontSize: '16px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                              {entry.mood}
                            </div>
                            <div style={{ color: '#64748B', fontSize: '12px' }}>
                              Intensity: {entry.intensity}/10
                            </div>
                          </div>
                        </div>
                        <div style={{ color: '#64748B', fontSize: '12px' }}>
                          {new Date(entry.createdAt).toLocaleDateString()} • {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {entry.note && (
                        <p style={{ color: '#CBD5E1', fontSize: '14px', marginTop: '10px', lineHeight: '1.5' }}>
                          {entry.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
