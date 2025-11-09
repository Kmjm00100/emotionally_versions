import React, { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useNavigate } from 'react-router-dom';
import Spinner from './Spinner';
import TopBar from './TopBar';
import BottomNav from './BottomNav';

export default function WritePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('Public');
  const [allowTrading, setAllowTrading] = useState(true);
  const [free, setFree] = useState(true);
  const [priceHearts, setPriceHearts] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState('');
  const [language, setLanguage] = useState('en');
  const [agree, setAgree] = useState(false);
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [proofFiles, setProofFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef();

  const submit = async () => {
    if (!token) { showToast('You must be logged in to post', 'error'); return }
    // basic validation
    if (!title.trim()) { showToast('Title is required', 'error'); return }
    if (title.length > 80) { showToast('Title must be <= 80 characters', 'error'); return }
    if (!content.trim() || content.length < 20) { showToast('Please add more content (min 20 chars)', 'error'); return }
    if (!agree) { showToast('You must accept the License & Terms', 'error'); return }
    if (!free && (!priceHearts || Number(priceHearts) <= 0)) { showToast('Enter a valid price in hearts', 'error'); return }
    // naive profanity/PII stub
    const banned = /(ssn\b|credit card|phone:\s*\+?\d{5,}|address:)/i; if (banned.test(content)) { showToast('Please remove sensitive personal data', 'error'); return }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('excerpt', content);
      fd.append('content', content);
      // Rarity is now auto-determined by AI, no need to send it
      fd.append('visibility', visibility);
      fd.append('allowTrading', String(allowTrading));
      fd.append('free', String(free));
      if (!free) fd.append('priceHearts', String(priceHearts || 0));
      fd.append('tags', tags);
      fd.append('categories', categories);
      fd.append('language', language);
      fd.append('emotion', '✍️');
      files.forEach(f => fd.append('images', f));
      proofFiles.forEach(f => fd.append('proofs', f));

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) { setProgress(Math.round(e.loaded * 100 / e.total)) } };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) { 
          setLoading(false); 
          setProgress(0); 
          xhrRef.current = null; 
          if (xhr.status >= 200 && xhr.status < 300) { 
            showToast('Published! 🤖 AI is analyzing your story...', 'success'); 
            navigate('/'); 
          } else { 
            try { 
              const d = JSON.parse(xhr.responseText); 
              showToast(d.error || 'Failed', 'error') 
            } catch (_) { 
              showToast('Failed', 'error') 
            } 
          } 
        }
      };
      xhr.open('POST', 'http://127.0.0.1:5000/api/posts');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(fd);
    } catch (e) { setLoading(false); showToast('Network error', 'error') }
  };

  const onFiles = (fl) => {
    const arr = [...fl]; setFiles(arr); setPreviews(arr.map(f => URL.createObjectURL(f)));
  };
  const onProofs = (fl) => { setProofFiles([...(fl || [])]); };
  const removePreview = (idx) => {
    setPreviews(p => p.filter((_, i) => i !== idx));
    setFiles(p => p.filter((_, i) => i !== idx));
  };
  // cleanup on unmount
  React.useEffect(() => {
    return () => {
      previews.forEach(p => { try { URL.revokeObjectURL(p) } catch (e) { } });
      if (xhrRef.current) { try { xhrRef.current.abort() } catch (e) { } }
    };
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="write-page">
        {/* Header Section */}
        <div className="write-header">
          <h2>Create Your Story</h2>
          <p className="subtitle">Share your emotional journey with the world</p>
        </div>

        {/* Main Content Form */}
        <div className="write-card">
          <div className="write-section">
            <label className="write-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Title
            </label>
            <input 
              className="write-input" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder='Give your emotion a meaningful title...'
              maxLength={80}
            />
            <div className="char-count">{title.length}/80</div>
          </div>

          <div className="write-section">
            <label className="write-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Your Story
            </label>
            <textarea 
              className="write-textarea" 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder='Pour your heart out... (minimum 20 characters)'
              rows={8}
            />
            <div className="char-count">{content.length} characters</div>
          </div>

          {/* Settings Grid */}
          <div className="write-section">
            <label className="write-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6M5.636 5.636l4.243 4.243m4.242 4.242l4.243 4.243M1 12h6m6 0h6m-11.364 6.364l4.243-4.243m4.242-4.242l4.243-4.243"/>
              </svg>
              Settings
            </label>
            <div className="settings-grid">
              <div className="setting-item">
                <span className="setting-name">Visibility</span>
                <select className="write-select" value={visibility} onChange={e => setVisibility(e.target.value)}>
                  <option>Public</option>
                  <option>Private</option>
                </select>
              </div>
              
              <div className="setting-item">
                <span className="setting-name">Language</span>
                <select className="write-select" value={language} onChange={e => setLanguage(e.target.value)}>
                  <option value='en'>English</option>
                  <option value='hi'>Hindi</option>
                  <option value='ta'>Tamil</option>
                  <option value='ml'>Malayalam</option>
                </select>
              </div>
            </div>
            
            {/* AI Rarity Info */}
            <div className="ai-info-box">
              <span className="ai-icon">🤖</span>
              <span className="ai-info-text">
                <strong>AI will analyze your story</strong> and automatically determine its rarity (Common, Rare, or Legendary) based on emotional depth, authenticity, and clarity.
              </span>
            </div>
          </div>

          {/* Trading & Price */}
          <div className="write-section">
            <label className="write-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Trading Options
            </label>
            <div className="settings-grid">
              <div className="checkbox-item">
                <label>
                  <input type='checkbox' checked={allowTrading} onChange={e => setAllowTrading(e.target.checked)} />
                  <span className="checkbox-label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 1l4 4-4 4"/>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                      <path d="M7 23l-4-4 4-4"/>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                    Allow Trading
                  </span>
                </label>
              </div>
              
              <div className="checkbox-item">
                <label>
                  <input type='checkbox' checked={free} onChange={e => setFree(e.target.checked)} />
                  <span className="checkbox-label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    Free
                  </span>
                </label>
              </div>
              
              {!free && (
                <div className="setting-item">
                  <span className="setting-name">Price (Hearts)</span>
                  <input 
                    className="write-input" 
                    type='number' 
                    value={priceHearts} 
                    onChange={e => setPriceHearts(e.target.value)} 
                    placeholder='Enter hearts amount'
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tags & Categories */}
          <div className="write-section">
            <label className="write-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              Tags & Categories
            </label>
            <input 
              className="write-input" 
              value={tags} 
              onChange={e => setTags(e.target.value)} 
              placeholder='Add tags (comma separated)'
            />
            <input 
              className="write-input" 
              value={categories} 
              onChange={e => setCategories(e.target.value)} 
              placeholder='Add categories (comma separated)'
            />
          </div>

          {/* Toggles */}
          <div className="write-section">
            <div className="toggles-row">
              <label className="toggle-label">
                <input type='checkbox' checked={allowTrading} onChange={e => setAllowTrading(e.target.checked)} />
                <span>🔄 Allow Trading</span>
              </label>
              <label className="toggle-label">
                <input type='checkbox' checked={free} onChange={e => setFree(e.target.checked)} />
                <span>💝 Free</span>
              </label>
            </div>
          </div>

          {/* Image Upload */}
          <div className="write-section">
            <label className="write-label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Images
            </label>
            <div className="file-upload">
              <input 
                type="file" 
                accept="image/*" 
                multiple 
                onChange={e => onFiles(e.target.files)}
                id="image-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="image-upload" className="file-upload-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 16 12 12 8 16"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  <polyline points="16 16 12 12 8 16"/>
                </svg>
                <span>Choose Images</span>
              </label>
            </div>
            {previews.length > 0 && (
              <div className="preview-grid">
                {previews.map((src, idx) => (
                  <div key={idx} className="preview-item">
                    <img src={src} alt="preview" />
                    <button className="remove-btn" onClick={() => removePreview(idx)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Terms Agreement */}
          <div className="write-section">
            <label className="terms-label">
              <input type='checkbox' checked={agree} onChange={e => setAgree(e.target.checked)} />
              <span>I agree to the <strong>License & Terms</strong>: ownership, content guidelines, and moderation policies.</span>
            </label>
          </div>

          {/* Progress Bar */}
          {progress > 0 && (
            <div className="upload-progress">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
              <span className="progress-text">{progress}%</span>
            </div>
          )}

          {/* Submit Button */}
          <button className="btn submit-btn" onClick={submit} disabled={loading}>
            {loading ? <Spinner /> : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
                <span>Publish Story</span>
              </>
            )}
          </button>
        </div>

        {/* Live Preview */}
        <div className="preview-card">
          <div className="preview-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Live Preview</span>
          </div>
          <article className="post preview-post">
            <div className="post-header">
              <span className="rarity-badge">
                🤖 AI will determine rarity
              </span>
            </div>
            <h3 className="preview-title">{title || 'Untitled Story'}</h3>
            <p className="preview-content">
              {content ? content.slice(0, 160) : 'Your story preview will appear here...'}
              {content.length > 160 && '...'}
            </p>
            {previews.length > 0 && (
              <div className="preview-images">
                <img src={previews[0]} alt="preview" />
              </div>
            )}
            <div className="preview-footer">
              <span className="preview-price">{free ? '💝 Free' : `💗 ${priceHearts || 0} Hearts`}</span>
              <span className="preview-visibility">{visibility}</span>
            </div>
          </article>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
