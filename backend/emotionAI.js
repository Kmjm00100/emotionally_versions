// emotionAI.js - AI-powered emotion detection and rating service
// Supports: OpenAI GPT, Google Gemini, xAI Grok
import dotenv from 'dotenv';
dotenv.config();

/**
 * Analyzes text content to detect emotions and provide ratings
 * Supports multiple AI providers: OpenAI, Gemini, Grok
 * 
 * @param {string} title - Post title
 * @param {string} content - Post content
 * @returns {Promise<Object>} - { emotion, emotionScore, detectedEmotions, aiRating, confidence }
 */
export async function analyzeEmotion(title, content) {
  const provider = process.env.AI_PROVIDER || 'openai'; // openai, gemini, grok, groq
  
  // Check for API keys
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const grokKey = process.env.GROK_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  
  // Determine which provider to use
  let apiKey, apiEndpoint, model;
  
  if (provider === 'groq' && groqKey) {
    apiKey = groqKey;
    apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    model = 'llama-3.3-70b-versatile'; // Updated to current model
  } else if (provider === 'gemini' && geminiKey) {
    apiKey = geminiKey;
    apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    model = 'gemini-pro';
    return analyzeWithGemini(title, content, apiKey);
  } else if (provider === 'grok' && grokKey) {
    apiKey = grokKey;
    apiEndpoint = 'https://api.x.ai/v1/chat/completions';
    model = 'grok-beta';
  } else if (openaiKey) {
    apiKey = openaiKey;
    apiEndpoint = process.env.AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    model = process.env.AI_MODEL || 'gpt-3.5-turbo';
  } else {
    console.warn('No AI API key found. Using fallback emotion detection.');
    return fallbackEmotionDetection(title, content);
  }

  try {
    const prompt = `Analyze the following emotional content and provide a structured response.

Title: "${title}"
Content: "${content}"

Provide your analysis in this exact JSON format:
{
  "primaryEmotion": "single emotion name (e.g., joy, sadness, anger, fear, love, surprise, disgust, trust, anticipation)",
  "emotionScore": number between 0-100 (intensity of the primary emotion),
  "detectedEmotions": ["list of all emotions detected"],
  "authenticity": number between 0-100 (how genuine/authentic the emotion feels),
  "depth": number between 0-100 (emotional depth and complexity),
  "clarity": number between 0-100 (how clearly the emotion is expressed),
  "rating": number between 0-10 (overall quality rating),
  "rarity": "Common, Rare, or Legendary (based on uniqueness and depth)",
  "tags": ["suggested emotional tags"],
  "summary": "brief 1-sentence summary"
}

Consider:
- Authenticity: Is this a genuine emotional expression?
- Depth: How profound is the emotional experience?
- Clarity: How well is the emotion communicated?
- Uniqueness: Is this a common or rare emotional expression?

Respond only with valid JSON.`;

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert emotion analyst. Analyze emotional content and provide structured insights in JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI API Error:', response.status, errorData);
      return fallbackEmotionDetection(title, content);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.error('No AI response received');
      return fallbackEmotionDetection(title, content);
    }

    // Parse JSON response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return fallbackEmotionDetection(title, content);
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      emotion: capitalizeFirst(analysis.primaryEmotion || 'neutral'),
      emotionScore: Math.min(100, Math.max(0, analysis.emotionScore || 50)),
      detectedEmotions: (analysis.detectedEmotions || []).map(e => capitalizeFirst(e)),
      aiRating: Math.min(10, Math.max(0, analysis.rating || 5)),
      authenticity: Math.min(100, Math.max(0, analysis.authenticity || 50)),
      depth: Math.min(100, Math.max(0, analysis.depth || 50)),
      clarity: Math.min(100, Math.max(0, analysis.clarity || 50)),
      suggestedRarity: analysis.rarity || 'Common',
      suggestedTags: analysis.tags || [],
      aiSummary: analysis.summary || '',
      confidence: 85,
      source: 'ai'
    };

  } catch (error) {
    console.error('Emotion analysis error:', error.message);
    return fallbackEmotionDetection(title, content);
  }
}

/**
 * Analyze emotions using Google Gemini API
 */
async function analyzeWithGemini(title, content, apiKey) {
  try {
    const prompt = `Analyze the following emotional content and provide a structured response.

Title: "${title}"
Content: "${content}"

Provide your analysis in this exact JSON format:
{
  "primaryEmotion": "single emotion name (e.g., joy, sadness, anger, fear, love, surprise, disgust, trust, anticipation)",
  "emotionScore": number between 0-100 (intensity of the primary emotion),
  "detectedEmotions": ["list of all emotions detected"],
  "authenticity": number between 0-100 (how genuine/authentic the emotion feels),
  "depth": number between 0-100 (emotional depth and complexity),
  "clarity": number between 0-100 (how clearly the emotion is expressed),
  "rating": number between 0-10 (overall quality rating),
  "rarity": "Common, Rare, or Legendary (based on uniqueness and depth)",
  "tags": ["suggested emotional tags"],
  "summary": "brief 1-sentence summary"
}

Consider:
- Authenticity: Is this a genuine emotional expression?
- Depth: How profound is the emotional experience?
- Clarity: How well is the emotion communicated?
- Uniqueness: Is this a common or rare emotional expression?

Respond only with valid JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API Error:', response.status, errorData);
      return fallbackEmotionDetection(title, content);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      console.error('No Gemini response received');
      return fallbackEmotionDetection(title, content);
    }

    // Parse JSON response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Gemini response');
      return fallbackEmotionDetection(title, content);
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      emotion: capitalizeFirst(analysis.primaryEmotion || 'neutral'),
      emotionScore: Math.min(100, Math.max(0, analysis.emotionScore || 50)),
      detectedEmotions: (analysis.detectedEmotions || []).map(e => capitalizeFirst(e)),
      aiRating: Math.min(10, Math.max(0, analysis.rating || 5)),
      authenticity: Math.min(100, Math.max(0, analysis.authenticity || 50)),
      depth: Math.min(100, Math.max(0, analysis.depth || 50)),
      clarity: Math.min(100, Math.max(0, analysis.clarity || 50)),
      suggestedRarity: analysis.rarity || 'Common',
      suggestedTags: analysis.tags || [],
      aiSummary: analysis.summary || '',
      confidence: 90,
      source: 'gemini'
    };

  } catch (error) {
    console.error('Gemini analysis error:', error.message);
    return fallbackEmotionDetection(title, content);
  }
}

/**
 * Fallback emotion detection using keyword matching
 */
function fallbackEmotionDetection(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  
  const emotionKeywords = {
    joy: ['happy', 'joy', 'excited', 'delighted', 'cheerful', 'wonderful', 'amazing', 'fantastic', 'blessed', 'grateful', 'gratitude'],
    sadness: ['sad', 'depressed', 'miserable', 'crying', 'tears', 'heartbroken', 'lonely', 'empty', 'loss', 'grief', 'grieving', 'mourning', 'sorrow', 'devastation', 'ache', 'pain', 'heavy', 'crushing'],
    anger: ['angry', 'furious', 'mad', 'rage', 'frustrated', 'annoyed', 'irritated', 'hate', 'upset', 'defiant'],
    fear: ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'nervous', 'panic', 'frightened', 'fear', 'dread'],
    love: ['love', 'adore', 'cherish', 'affection', 'romance', 'passion', 'devoted', 'caring', 'tender', 'beloved'],
    surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected', 'wow', 'incredible', 'sudden'],
    trust: ['trust', 'faith', 'believe', 'confident', 'reliable', 'secure', 'acceptance', 'accepting', 'peace', 'peaceful'],
    anticipation: ['hope', 'hopeful', 'excited', 'looking forward', 'anticipate', 'eager', 'expectant', 'future', 'tomorrow'],
    disgust: ['disgusted', 'revolted', 'sick', 'repulsed', 'gross'],
    neutral: ['feel', 'think', 'consider', 'maybe', 'perhaps', 'understand', 'realize']
  };

  const scores = {};
  let totalScore = 0;

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * 10;
      }
    }
    scores[emotion] = score;
    totalScore += score;
  }

  // Find primary emotion
  let primaryEmotion = 'neutral';
  let maxScore = 0;
  const detectedEmotions = [];

  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      primaryEmotion = emotion;
    }
    if (score > 0) {
      detectedEmotions.push(emotion);
    }
  }

  const emotionScore = totalScore > 0 ? Math.min(100, (maxScore / totalScore) * 100) : 50;
  const contentLength = content.length;
  
  // Improved depth calculation considering multiple factors
  const emotionDiversity = detectedEmotions.length;
  const lengthScore = Math.min(50, contentLength / 20); // Long content = more depth
  const emotionComplexity = emotionDiversity * 15; // More emotions = more complex
  const depth = Math.min(100, Math.floor(lengthScore + emotionComplexity));
  
  const clarity = Math.min(100, Math.floor(contentLength / 15));
  
  // Better authenticity calculation
  const authenticity = Math.min(100, Math.floor(
    (emotionDiversity * 12) + // Diverse emotions = authentic
    (contentLength / 25) + // Detailed content = authentic
    (totalScore / 10) // Strong emotions = authentic
  ));
  
  // Improved rating that considers all factors
  const avgQuality = (authenticity + depth + clarity) / 3;
  const aiRating = Math.min(10, Math.max(1, Math.floor(
    (avgQuality / 10) + // Quality baseline
    (emotionDiversity * 0.5) // Bonus for emotional complexity
  )));
  
  // Much better rarity determination
  let suggestedRarity = 'Common';
  if (emotionDiversity >= 6 && avgQuality > 60 && contentLength > 500) {
    suggestedRarity = 'Legendary'; // Complex, high quality, substantial
  } else if (emotionDiversity >= 4 && avgQuality > 50 && contentLength > 300) {
    suggestedRarity = 'Rare'; // Good complexity and quality
  } else if (emotionDiversity >= 3 || avgQuality > 40) {
    suggestedRarity = 'Rare'; // Some complexity OR decent quality
  }

  return {
    emotion: capitalizeFirst(primaryEmotion),
    emotionScore: Math.floor(emotionScore),
    detectedEmotions: detectedEmotions.map(e => capitalizeFirst(e)),
    aiRating,
    authenticity: Math.floor(authenticity),
    depth: Math.floor(depth),
    clarity: Math.floor(clarity),
    suggestedRarity,
    suggestedTags: detectedEmotions.slice(0, 5),
    aiSummary: `${capitalizeFirst(primaryEmotion)} emotion with ${emotionDiversity} dimensions. ${suggestedRarity} quality detected.`,
    confidence: 60,
    source: 'fallback'
  };
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Quick emotion check (lightweight version)
 */
export function quickEmotionCheck(text) {
  const emotions = {
    '😊': ['happy', 'joy', 'smile', 'laugh'],
    '😢': ['sad', 'cry', 'tear', 'sorrow'],
    '😡': ['angry', 'mad', 'rage', 'furious'],
    '😨': ['fear', 'scared', 'afraid', 'worry'],
    '❤️': ['love', 'romance', 'heart', 'adore'],
    '😮': ['surprise', 'shock', 'wow', 'amaze']
  };

  const lowerText = text.toLowerCase();
  
  for (const [emoji, keywords] of Object.entries(emotions)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return emoji;
      }
    }
  }
  
  return '✨'; // default neutral
}
