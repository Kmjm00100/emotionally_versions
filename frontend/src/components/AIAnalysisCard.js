import React from 'react';

export default function AIAnalysisCard({ analysis, compact = false }) {
  if (!analysis || !analysis.source || analysis.source === 'none') {
    return null;
  }

  if (compact) {
    return (
      <div className="ai-analysis-compact">
        <div className="ai-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          AI Analyzed
        </div>
        <span className="ai-rating">⭐ {analysis.aiRating}/10</span>
      </div>
    );
  }

  return (
    <div className="ai-analysis-card">
      <div className="ai-analysis-header">
        <div className="ai-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          <h4>AI Emotion Analysis</h4>
        </div>
        <div className="ai-source-badge">
          {analysis.source === 'ai' ? '🤖 GPT' : '🔍 Keyword'}
        </div>
      </div>

      {analysis.aiSummary && (
        <p className="ai-summary">{analysis.aiSummary}</p>
      )}

      <div className="ai-metrics-grid">
        <div className="ai-metric">
          <div className="ai-metric-label">Overall Rating</div>
          <div className="ai-metric-value large">⭐ {analysis.aiRating}/10</div>
        </div>
        
        <div className="ai-metric">
          <div className="ai-metric-label">Emotion Intensity</div>
          <div className="ai-metric-value">{analysis.emotionScore}%</div>
          <div className="ai-progress-bar">
            <div className="ai-progress-fill" style={{width: `${analysis.emotionScore}%`}}></div>
          </div>
        </div>

        <div className="ai-metric">
          <div className="ai-metric-label">Authenticity</div>
          <div className="ai-metric-value">{analysis.authenticity}%</div>
          <div className="ai-progress-bar">
            <div className="ai-progress-fill" style={{width: `${analysis.authenticity}%`}}></div>
          </div>
        </div>

        <div className="ai-metric">
          <div className="ai-metric-label">Emotional Depth</div>
          <div className="ai-metric-value">{analysis.depth}%</div>
          <div className="ai-progress-bar">
            <div className="ai-progress-fill" style={{width: `${analysis.depth}%`}}></div>
          </div>
        </div>

        <div className="ai-metric">
          <div className="ai-metric-label">Clarity</div>
          <div className="ai-metric-value">{analysis.clarity}%</div>
          <div className="ai-progress-bar">
            <div className="ai-progress-fill" style={{width: `${analysis.clarity}%`}}></div>
          </div>
        </div>

        <div className="ai-metric">
          <div className="ai-metric-label">Confidence</div>
          <div className="ai-metric-value">{analysis.confidence}%</div>
          <div className="ai-progress-bar">
            <div className="ai-progress-fill confidence" style={{width: `${analysis.confidence}%`}}></div>
          </div>
        </div>
      </div>

      {analysis.detectedEmotions && analysis.detectedEmotions.length > 0 && (
        <div className="ai-emotions">
          <div className="ai-emotions-label">Detected Emotions:</div>
          <div className="ai-emotions-tags">
            {analysis.detectedEmotions.map((emotion, idx) => (
              <span key={idx} className="ai-emotion-tag">{emotion}</span>
            ))}
          </div>
        </div>
      )}

      {analysis.suggestedTags && analysis.suggestedTags.length > 0 && (
        <div className="ai-suggestions">
          <div className="ai-suggestions-label">Suggested Tags:</div>
          <div className="ai-suggestions-tags">
            {analysis.suggestedTags.map((tag, idx) => (
              <span key={idx} className="ai-suggestion-tag">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {analysis.suggestedRarity && (
        <div className="ai-rarity">
          <span className="ai-rarity-label">AI Suggested Rarity:</span>
          <span className={`ai-rarity-badge ${analysis.suggestedRarity.toLowerCase()}`}>
            {analysis.suggestedRarity}
          </span>
        </div>
      )}

      <div className="ai-footer">
        <small>Analyzed: {new Date(analysis.analyzedAt).toLocaleString()}</small>
      </div>
    </div>
  );
}
