import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Spinner from '../components/Spinner';

import { API_URL } from '../config';

const categories = [
  { value: 'posts', label: 'Posts', emoji: '📝' },
  { value: 'hearts', label: 'Hearts', emoji: '💖' },
  { value: 'services', label: 'Services', emoji: '🤝' },
  { value: 'collaboration', label: 'Collaboration', emoji: '👥' }
];

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('browse'); // 'browse', 'create', 'myListings', 'myTrades'
  const [listings, setListings] = useState([]);
  const [trades, setTrades] = useState([]);
  const [myListings, setMyListings] = useState([]);

  // Create listing form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [offeringDescription, setOfferingDescription] = useState('');
  const [offeringHearts, setOfferingHearts] = useState('');
  const [seekingDescription, setSeekingDescription] = useState('');
  const [seekingHearts, setSeekingHearts] = useState('');
  const [tags, setTags] = useState('');

  // Trade modal states
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [tradeMessage, setTradeMessage] = useState('');
  const [tradeOfferHearts, setTradeOfferHearts] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchListings();
    fetchTrades();
  }, [token, navigate]);

  const fetchListings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/listings`);
      const data = await res.json();
      if (res.ok) {
        setListings(data.listings);
      }
    } catch (error) {
      console.error('Fetch listings error:', error);
    }
  };

  const fetchTrades = async () => {
    try {
      const res = await fetch(`${API_URL}/api/trades/enhanced`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTrades(data.trades);
      }
    } catch (error) {
      console.error('Fetch trades error:', error);
    }
  };

  const createListing = async (e) => {
    e.preventDefault();
    if (!title.trim() || !category) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/marketplace/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          offering: {
            description: offeringDescription.trim(),
            hearts: offeringHearts ? parseInt(offeringHearts) : 0
          },
          seeking: {
            description: seekingDescription.trim(),
            hearts: seekingHearts ? parseInt(seekingHearts) : 0
          },
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
        })
      });

      if (res.ok) {
        // Reset form
        setTitle('');
        setDescription('');
        setCategory('');
        setOfferingDescription('');
        setOfferingHearts('');
        setSeekingDescription('');
        setSeekingHearts('');
        setTags('');
        
        await fetchListings();
        setView('browse');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create listing');
      }
    } catch (error) {
      console.error('Create listing error:', error);
      alert('Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  const createTrade = async (e) => {
    e.preventDefault();
    if (!tradeOfferHearts && !tradeMessage.trim()) {
      alert('Please offer something or add a message');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/trades/enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          toUserId: selectedListing.userId._id,
          offer: {
            hearts: tradeOfferHearts ? parseInt(tradeOfferHearts) : 0
          },
          request: {
            description: selectedListing.offering.description,
            hearts: selectedListing.offering.hearts || 0
          },
          message: tradeMessage.trim()
        })
      });

      if (res.ok) {
        setShowTradeModal(false);
        setSelectedListing(null);
        setTradeMessage('');
        setTradeOfferHearts('');
        await fetchTrades();
        alert('Trade offer sent successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to send trade offer');
      }
    } catch (error) {
      console.error('Create trade error:', error);
      alert('Failed to send trade offer');
    } finally {
      setLoading(false);
    }
  };

  const updateTrade = async (tradeId, action, rating = null, comment = '') => {
    try {
      const res = await fetch(`${API_URL}/api/trades/enhanced/${tradeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, rating, comment })
      });

      if (res.ok) {
        await fetchTrades();
        alert(`Trade ${action}ed successfully!`);
      } else {
        const error = await res.json();
        alert(error.error || `Failed to ${action} trade`);
      }
    } catch (error) {
      console.error('Update trade error:', error);
      alert(`Failed to ${action} trade`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCategoryInfo = (categoryValue) => {
    return categories.find(cat => cat.value === categoryValue) || categories[0];
  };

  const getTradeStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#32CD32';
      case 'completed': return '#228B22';
      case 'rejected': return '#DC143C';
      default: return '#666';
    }
  };

  if (loading && view === 'browse' && listings.length === 0) {
    return (
      <div className="page">
        <TopBar title="Marketplace" showBack={false} />
        <Spinner />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar title="🏪 Marketplace" showBack={false} />
      
      <div className="content">
        {/* Tab Navigation */}
        <div className="tab-nav">
          <button 
            className={view === 'browse' ? 'tab active' : 'tab'}
            onClick={() => setView('browse')}
          >
            Browse
          </button>
          <button 
            className={view === 'create' ? 'tab active' : 'tab'}
            onClick={() => setView('create')}
          >
            Create Listing
          </button>
          <button 
            className={view === 'myTrades' ? 'tab active' : 'tab'}
            onClick={() => setView('myTrades')}
          >
            My Trades
          </button>
        </div>

        {/* Browse Listings */}
        {view === 'browse' && (
          <div className="listings-browse">
            {listings.length === 0 ? (
              <div className="empty-state">
                <h3>🏪 No Listings Yet</h3>
                <p>Be the first to create a marketplace listing!</p>
                <button 
                  className="btn primary" 
                  onClick={() => setView('create')}
                >
                  Create First Listing
                </button>
              </div>
            ) : (
              <div className="listings-grid">
                {listings.map(listing => {
                  const categoryInfo = getCategoryInfo(listing.category);
                  
                  return (
                    <div key={listing._id} className="listing-card">
                      <div className="listing-header">
                        <div className="listing-category">
                          <span className="category-emoji">{categoryInfo.emoji}</span>
                          <span className="category-name">{categoryInfo.label}</span>
                        </div>
                        <div className="listing-date">{formatDate(listing.createdAt)}</div>
                      </div>

                      <h3 className="listing-title">{listing.title}</h3>
                      
                      {listing.description && (
                        <p className="listing-description">{listing.description}</p>
                      )}

                      <div className="listing-details">
                        <div className="offering-section">
                          <h4>🎁 Offering:</h4>
                          {listing.offering.description && (
                            <p>{listing.offering.description}</p>
                          )}
                          {listing.offering.hearts > 0 && (
                            <p>💖 {listing.offering.hearts} Hearts</p>
                          )}
                        </div>

                        <div className="seeking-section">
                          <h4>🔍 Seeking:</h4>
                          {listing.seeking.description && (
                            <p>{listing.seeking.description}</p>
                          )}
                          {listing.seeking.hearts > 0 && (
                            <p>💖 {listing.seeking.hearts} Hearts</p>
                          )}
                        </div>
                      </div>

                      <div className="listing-footer">
                        <div className="user-info">
                          <span className="username">@{listing.userId.username}</span>
                          <span className="user-level">Level {listing.userId.level}</span>
                          <span className="user-rating">⭐ {listing.userId.tradeStats.rating.toFixed(1)}</span>
                        </div>
                        
                        <button 
                          className="btn primary small"
                          onClick={() => {
                            setSelectedListing(listing);
                            setShowTradeModal(true);
                          }}
                        >
                          Make Offer
                        </button>
                      </div>

                      {listing.tags && listing.tags.length > 0 && (
                        <div className="listing-tags">
                          {listing.tags.map((tag, index) => (
                            <span key={index} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create Listing */}
        {view === 'create' && (
          <form onSubmit={createListing} className="create-listing-form">
            <h2>📝 Create Marketplace Listing</h2>
            
            <div className="form-group">
              <label>Listing Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Trading emotional poems for supportive feedback"
                maxLength={100}
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you're looking to trade..."
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <div className="category-grid">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`category-option ${category === cat.value ? 'selected' : ''}`}
                    onClick={() => setCategory(cat.value)}
                  >
                    <span className="category-emoji">{cat.emoji}</span>
                    <span className="category-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h3>🎁 What are you offering?</h3>
              
              <div className="form-group">
                <label>Description of what you're offering</label>
                <textarea
                  value={offeringDescription}
                  onChange={(e) => setOfferingDescription(e.target.value)}
                  placeholder="Describe what you can provide..."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Hearts (if offering)</label>
                <input
                  type="number"
                  value={offeringHearts}
                  onChange={(e) => setOfferingHearts(e.target.value)}
                  placeholder="Number of hearts to offer"
                  min="0"
                />
              </div>
            </div>

            <div className="form-section">
              <h3>🔍 What are you seeking?</h3>
              
              <div className="form-group">
                <label>Description of what you want</label>
                <textarea
                  value={seekingDescription}
                  onChange={(e) => setSeekingDescription(e.target.value)}
                  placeholder="Describe what you're looking for..."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Hearts (if seeking)</label>
                <input
                  type="number"
                  value={seekingHearts}
                  onChange={(e) => setSeekingHearts(e.target.value)}
                  placeholder="Number of hearts you want"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Tags (optional)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="poetry, support, collaboration (comma-separated)"
              />
            </div>

            <button type="submit" className="btn primary large" disabled={loading}>
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </form>
        )}

        {/* My Trades */}
        {view === 'myTrades' && (
          <div className="trades-view">
            <h2>💼 My Trades</h2>
            
            {trades.length === 0 ? (
              <div className="empty-state">
                <h3>🤝 No Trades Yet</h3>
                <p>Start trading by making offers on marketplace listings!</p>
                <button 
                  className="btn primary" 
                  onClick={() => setView('browse')}
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="trades-list">
                {trades.map(trade => (
                  <div key={trade._id} className="trade-card">
                    <div className="trade-header">
                      <div 
                        className="trade-status" 
                        style={{ backgroundColor: getTradeStatusColor(trade.status) }}
                      >
                        {trade.status.toUpperCase()}
                      </div>
                      <div className="trade-date">{formatDate(trade.createdAt)}</div>
                    </div>

                    <div className="trade-participants">
                      <div className="participant">
                        <strong>From:</strong> @{trade.fromUserId.username}
                        <span className="user-level">(Level {trade.fromUserId.level})</span>
                      </div>
                      <div className="participant">
                        <strong>To:</strong> @{trade.toUserId.username}
                        <span className="user-level">(Level {trade.toUserId.level})</span>
                      </div>
                    </div>

                    <div className="trade-details">
                      <div className="trade-offer">
                        <h4>🎁 Offering:</h4>
                        {trade.offer.hearts > 0 && (
                          <p>💖 {trade.offer.hearts} Hearts</p>
                        )}
                        {trade.offer.description && (
                          <p>{trade.offer.description}</p>
                        )}
                      </div>

                      <div className="trade-request">
                        <h4>🔍 Requesting:</h4>
                        {trade.request.hearts > 0 && (
                          <p>💖 {trade.request.hearts} Hearts</p>
                        )}
                        {trade.request.description && (
                          <p>{trade.request.description}</p>
                        )}
                      </div>
                    </div>

                    {trade.message && (
                      <div className="trade-message">
                        <strong>Message:</strong> {trade.message}
                      </div>
                    )}

                    <div className="trade-actions">
                      {trade.status === 'pending' && trade.toUserId._id === token && (
                        <>
                          <button 
                            className="btn primary small"
                            onClick={() => updateTrade(trade._id, 'accept')}
                          >
                            Accept
                          </button>
                          <button 
                            className="btn secondary small"
                            onClick={() => updateTrade(trade._id, 'reject')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      
                      {trade.status === 'completed' && !trade.ratings.fromUserRating && (
                        <button 
                          className="btn secondary small"
                          onClick={() => {
                            const rating = prompt('Rate this trade (1-5 stars):');
                            const comment = prompt('Leave a comment (optional):');
                            if (rating && rating >= 1 && rating <= 5) {
                              updateTrade(trade._id, 'rate', parseInt(rating), comment || '');
                            }
                          }}
                        >
                          Rate Trade
                        </button>
                      )}
                    </div>

                    {(trade.ratings.fromUserRating || trade.ratings.toUserRating) && (
                      <div className="trade-ratings">
                        <h4>Ratings:</h4>
                        {trade.ratings.fromUserRating && (
                          <p>⭐ {trade.ratings.fromUserRating}/5 - {trade.ratings.fromUserComment}</p>
                        )}
                        {trade.ratings.toUserRating && (
                          <p>⭐ {trade.ratings.toUserRating}/5 - {trade.ratings.toUserComment}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trade Modal */}
        {showTradeModal && selectedListing && (
          <div className="modal-overlay" onClick={() => setShowTradeModal(false)}>
            <div className="modal large" onClick={(e) => e.stopPropagation()}>
              <h3>Make Trade Offer</h3>
              <p>Trading with: <strong>@{selectedListing.userId.username}</strong></p>
              
              <div className="trade-summary">
                <div className="they-offer">
                  <h4>🎁 They're offering:</h4>
                  {selectedListing.offering.description && (
                    <p>{selectedListing.offering.description}</p>
                  )}
                  {selectedListing.offering.hearts > 0 && (
                    <p>💖 {selectedListing.offering.hearts} Hearts</p>
                  )}
                </div>
              </div>
              
              <form onSubmit={createTrade}>
                <div className="form-group">
                  <label>Hearts to Offer</label>
                  <input
                    type="number"
                    value={tradeOfferHearts}
                    onChange={(e) => setTradeOfferHearts(e.target.value)}
                    placeholder="Number of hearts to offer"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Message *</label>
                  <textarea
                    value={tradeMessage}
                    onChange={(e) => setTradeMessage(e.target.value)}
                    placeholder="Explain your offer and why you're interested..."
                    required
                    rows={3}
                  />
                </div>

                <div className="modal-actions">
                  <button 
                    type="button"
                    className="btn secondary" 
                    onClick={() => setShowTradeModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="btn primary"
                    disabled={loading}
                  >
                    {loading ? 'Sending...' : 'Send Offer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}