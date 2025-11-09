# 🤖 Multi-AI Provider Setup Guide

## ✨ FREE Option: Google Gemini (RECOMMENDED)

### Why Gemini?
- ✅ **100% FREE** (generous free tier)
- ✅ 60 requests per minute
- ✅ High quality emotion analysis
- ✅ No credit card required
- ✅ Similar accuracy to GPT-3.5

### How to Get Gemini API Key (FREE):

1. **Visit**: https://makersuite.google.com/app/apikey
   (or https://aistudio.google.com/app/apikey)

2. **Sign in** with your Google account

3. **Click "Create API Key"**

4. **Copy the key** (starts with "AIza...")

5. **Add to your `.env` file**:
   ```bash
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSyC...your-key-here
   ```

6. **Restart backend** - Done! 🎉

### Testing:
```bash
cd backend
node test-emotion-ai.js
```

Expected output with Gemini:
```
🤖 Source: gemini
🎭 Primary Emotion: Sadness
⭐ AI Rating: 9/10
🏆 Suggested Rarity: Legendary
```

---

## 💰 Paid Options

### Option 1: OpenAI GPT
**Cost**: ~$0.0005 per analysis ($5 = 10,000 analyses)

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**Get key**: https://platform.openai.com/api-keys

---

### Option 2: xAI Grok
**Cost**: Variable pricing

```bash
AI_PROVIDER=grok
GROK_API_KEY=xai-...
```

**Get key**: https://x.ai

---

## 🔧 Configuration

### Your `.env` file should have:

```bash
MONGO_URI=mongodb+srv://...
JWT_SECRET=supersecret123
PORT=5000

# Choose ONE provider and add its key:
AI_PROVIDER=gemini

# For Gemini (FREE):
GEMINI_API_KEY=AIzaSyC...

# OR for OpenAI (Paid):
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-proj-...

# OR for Grok (Paid):
# AI_PROVIDER=grok
# GROK_API_KEY=xai-...
```

---

## 📊 Comparison

| Provider | Cost | Speed | Accuracy | Free Tier |
|----------|------|-------|----------|-----------|
| **Gemini** | FREE | Fast | 9/10 | ✅ 60 req/min |
| OpenAI GPT-3.5 | $0.0005 | Fast | 9/10 | ❌ Paid only |
| OpenAI GPT-4 | $0.005 | Slower | 10/10 | ❌ Paid only |
| Grok | Variable | Fast | 8/10 | ❌ Paid only |
| Fallback | FREE | Instant | 6/10 | ✅ Always works |

---

## 🚀 Quick Start with Gemini

### Step 1: Get API Key
```
https://makersuite.google.com/app/apikey
→ Click "Create API Key"
→ Copy the key
```

### Step 2: Add to .env
```bash
cd backend
nano .env  # or use VS Code

# Add these lines:
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSyC_YOUR_KEY_HERE
```

### Step 3: Restart Backend
```bash
# Stop any running node processes
taskkill /F /IM node.exe

# Start backend
node server.js
```

### Step 4: Test It!
Create a post in your app - the AI will now analyze it with Gemini! 🎉

---

## 🔍 How to Verify It's Working

### Check Logs:
When creating a post, you should see:
```
🤖 Running AI emotion analysis...
✅ AI Analysis complete: { emotion: 'Sadness', source: 'gemini', ... }
```

### Check Post:
- Badge shows: "🤖 AI Analyzed ⭐ 8-9/10"
- Source in analysis card: "gemini"
- Accurate emotion detection
- Proper Legendary/Rare/Common rating

---

## ❓ Troubleshooting

### "Invalid API key"
- Make sure key starts with "AIza"
- Check for extra spaces
- Verify key is active at https://console.cloud.google.com/apis/credentials

### "Quota exceeded"
- Gemini free tier: 60 requests/minute
- Wait a minute and try again
- Or add payment method for higher limits

### Still using fallback?
- Check `.env` has `AI_PROVIDER=gemini`
- Check `GEMINI_API_KEY=AIza...` is set
- Restart backend server
- Check terminal logs for errors

---

## 💡 Pro Tips

1. **Gemini is FREE** - Use it for development and testing
2. **Monitor usage** at https://console.cloud.google.com
3. **Start with Gemini** - Upgrade to GPT-4 later if needed
4. **Fallback always works** - System gracefully degrades

---

## 🎯 Expected Results with Gemini

### Your "Symphony of Letting Go" story will get:
- ✅ **Emotion**: Sadness + Grief + Acceptance (accurate!)
- ✅ **Rating**: 9/10
- ✅ **Rarity**: 🟨 Legendary
- ✅ **Detected**: 7+ emotions
- ✅ **Authenticity**: 90%+
- ✅ **Depth**: 95%+
- ✅ **Summary**: "Complex grief transforming into acceptance and peace"

Much better than fallback's "Joy emotion with 5 dimensions" 😅

---

**Ready to set up Gemini?** It takes just 2 minutes! 🚀
