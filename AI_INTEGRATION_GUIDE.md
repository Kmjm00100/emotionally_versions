# AI Emotion Detection Integration Guide

## Overview
The Emotionally app now includes AI-powered emotion detection and rating system that automatically analyzes posts to:
- Detect primary and secondary emotions
- Rate emotional authenticity, depth, and clarity
- Provide overall quality ratings (0-10 scale)
- Suggest appropriate tags and rarity levels
- Generate emotional summaries

## Features

### 1. **Automatic Analysis**
When users create a post, the system automatically:
- Analyzes the title and content
- Detects emotional patterns
- Assigns emotion scores and ratings
- Suggests tags and categorization

### 2. **Dual-Mode Operation**
- **AI Mode**: Uses OpenAI GPT API for sophisticated analysis
- **Fallback Mode**: Uses keyword-based detection when no API key is available

### 3. **Visual Feedback**
- Compact AI badges on post cards
- Detailed analysis view with metrics
- Progress bars for various emotional dimensions
- Confidence indicators

## Setup Instructions

### Step 1: Get an API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an account or sign in
3. Generate a new API key
4. Copy the key (it starts with `sk-...`)

### Step 2: Configure Environment Variables
1. Navigate to the `backend` folder
2. Create or edit the `.env` file
3. Add your API key:

```bash
# AI Configuration
OPENAI_API_KEY=sk-your-actual-api-key-here

# Optional: Use different model
AI_MODEL=gpt-3.5-turbo  # or gpt-4, gpt-4-turbo-preview

# Optional: Use alternative GPT-compatible API
# AI_API_ENDPOINT=https://your-custom-endpoint.com/v1/chat/completions
```

### Step 3: Restart the Backend
```bash
cd backend
npm start
```

## API Endpoints

### POST /api/posts
Creates a new post with automatic AI analysis
- **Authentication**: Required (JWT token)
- **Body**: Standard post data (title, content, etc.)
- **Returns**: Post object with `aiAnalysis` field

### POST /api/posts/:id/analyze
Re-analyzes an existing post
- **Authentication**: Required (must be post owner)
- **Returns**: Updated analysis results

### GET /api/posts/:id/analysis
Retrieves AI analysis for a post
- **Authentication**: Not required
- **Returns**: Analysis data and emotion information

## Analysis Metrics

The AI provides multiple dimensions of emotional analysis:

### 1. **Overall Rating** (0-10)
- Comprehensive quality score
- Considers all other metrics
- Displayed as star rating

### 2. **Emotion Score** (0-100%)
- Intensity of the primary emotion
- Higher = more emotionally charged

### 3. **Authenticity** (0-100%)
- How genuine the emotion feels
- Detects forced or artificial expressions

### 4. **Depth** (0-100%)
- Emotional complexity
- Layered feelings vs. surface-level

### 5. **Clarity** (0-100%)
- How clearly emotions are expressed
- Writing quality and coherence

### 6. **Confidence** (0-100%)
- AI's certainty about the analysis
- AI mode: typically 85%
- Fallback mode: typically 60%

## Fallback Mode

If no API key is provided, the system uses intelligent keyword matching:
- Scans for emotional keywords
- Calculates emotion intensity
- Provides basic ratings
- Works offline
- No API costs

**Detected Emotions:**
- Joy, Sadness, Anger, Fear
- Love, Surprise, Trust, Anticipation
- Disgust, Neutral

## Cost Considerations

### OpenAI Pricing (as of 2024)
- **GPT-3.5-turbo**: ~$0.0005 per analysis
- **GPT-4**: ~$0.005 per analysis
- 1000 posts analyzed = $0.50 - $5.00

### Cost Optimization Tips
1. Use GPT-3.5-turbo (cheaper, faster)
2. Enable caching for re-analysis
3. Set rate limits in production
4. Use fallback mode for low-value content

## Frontend Integration

### Displaying Analysis
The `AIAnalysisCard` component automatically displays analysis:

```jsx
import AIAnalysisCard from './components/AIAnalysisCard';

// Compact badge
<AIAnalysisCard analysis={post.aiAnalysis} compact={true} />

// Full analysis view
<AIAnalysisCard analysis={post.aiAnalysis} />
```

### Conditional Rendering
```jsx
{post.aiAnalysis && post.aiAnalysis.source !== 'none' && (
  <AIAnalysisCard analysis={post.aiAnalysis} compact={true} />
)}
```

## Troubleshooting

### "No AI response received"
- Check your API key is correct
- Verify OpenAI account has credits
- Check network connectivity
- Review backend logs for details

### "Using fallback emotion detection"
- No `OPENAI_API_KEY` in `.env`
- API key invalid or expired
- OpenAI service down
- System automatically uses keyword matching

### Analysis Not Showing
- Check MongoDB schema updated
- Restart backend after adding AI fields
- Clear browser cache
- Verify post has `aiAnalysis` field

## Customization

### Change AI Model
In `.env`:
```bash
AI_MODEL=gpt-4  # More accurate, more expensive
AI_MODEL=gpt-3.5-turbo  # Faster, cheaper
```

### Use Alternative AI Services
Any OpenAI-compatible API works:
```bash
AI_API_ENDPOINT=https://api.anthropic.com/v1/messages
AI_API_KEY=your-anthropic-key
```

### Adjust Analysis Prompt
Edit `backend/emotionAI.js` to customize:
- Detected emotions
- Rating criteria
- Output format
- Language support

## Privacy & Security

### Data Sent to AI
- Post title
- Post content
- No user information
- No images or media

### Security Best Practices
1. Never commit `.env` to git
2. Use environment-specific keys
3. Rotate keys periodically
4. Monitor API usage
5. Set rate limits

## Performance

### Analysis Speed
- **AI Mode**: 1-3 seconds per post
- **Fallback Mode**: <100ms per post

### Optimization
- Analysis runs async (doesn't block post creation)
- Results cached in database
- Re-analysis only when requested
- Batch processing possible

## Future Enhancements

Potential improvements:
- Multi-language support
- Image emotion analysis
- Sentiment trends over time
- Emotion-based recommendations
- Custom training for your domain
- Real-time emotion detection

## Support

For issues or questions:
1. Check backend logs: `console.log` messages
2. Verify `.env` configuration
3. Test with fallback mode first
4. Review OpenAI API status page

## License

This AI integration follows the same license as the main project.
OpenAI API usage subject to OpenAI's terms of service.
