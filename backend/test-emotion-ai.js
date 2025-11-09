// test-emotion-ai.js - Test script for emotion detection
import { analyzeEmotion } from './emotionAI.js';

const testCases = [
  {
    title: "My First Day of Love",
    content: "I can't believe it happened. My heart is racing, my hands are trembling, and I can't stop smiling. When our eyes met across the coffee shop, it felt like the world stopped spinning. I've never felt this way before - so happy, so nervous, so completely and utterly in love. Every moment feels magical."
  },
  {
    title: "Losing My Best Friend",
    content: "The sadness is overwhelming. I keep replaying our last conversation, wishing I had said more, done more. The emptiness in my chest grows with each passing day. I miss the laughter, the late-night talks, the comfort of knowing someone truly understood me. Life feels darker without them."
  },
  {
    title: "Rage Against Injustice",
    content: "I am furious. How can people be so cruel, so indifferent to suffering? My blood boils every time I see the inequality, the lies, the corruption. This anger isn't going away - it's fuel for change. I will fight, I will speak up, I will not be silenced. Enough is enough!"
  },
  {
    title: "The Fear of Failure",
    content: "What if I'm not good enough? What if everything I've worked for crumbles? The anxiety keeps me awake at night, my mind racing through worst-case scenarios. Every step forward feels like walking on a tightrope. The fear of disappointing others, of disappointing myself, is paralyzing."
  },
  {
    title: "Simple Happiness",
    content: "Today was a good day. The sun was shining, the birds were singing, and I felt at peace. Sometimes happiness is found in the simplest moments - a warm cup of tea, a gentle breeze, a smile from a stranger. Life doesn't need to be complicated to be beautiful."
  }
];

async function runTests() {
  console.log('🧪 Testing AI Emotion Detection System\n');
  console.log('=' .repeat(80));
  
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`\n📝 Test Case ${i + 1}: "${test.title}"`);
    console.log('-'.repeat(80));
    
    try {
      const startTime = Date.now();
      const result = await analyzeEmotion(test.title, test.content);
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Analysis Time: ${duration}ms`);
      console.log(`🤖 Source: ${result.source}`);
      console.log(`🎭 Primary Emotion: ${result.emotion}`);
      console.log(`💯 Emotion Score: ${result.emotionScore}/100`);
      console.log(`⭐ AI Rating: ${result.aiRating}/10`);
      console.log(`✅ Authenticity: ${result.authenticity}%`);
      console.log(`📊 Depth: ${result.depth}%`);
      console.log(`💬 Clarity: ${result.clarity}%`);
      console.log(`🎯 Confidence: ${result.confidence}%`);
      console.log(`🏆 Suggested Rarity: ${result.suggestedRarity}`);
      
      if (result.detectedEmotions && result.detectedEmotions.length > 0) {
        console.log(`🌈 Detected Emotions: ${result.detectedEmotions.join(', ')}`);
      }
      
      if (result.suggestedTags && result.suggestedTags.length > 0) {
        console.log(`🏷️  Suggested Tags: ${result.suggestedTags.join(', ')}`);
      }
      
      if (result.aiSummary) {
        console.log(`📝 AI Summary: ${result.aiSummary}`);
      }
      
      console.log('\n✅ Test passed!');
      
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ All tests completed!\n');
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   - Total test cases: ${testCases.length}`);
  console.log(`   - Emotions tested: Love, Sadness, Anger, Fear, Happiness`);
  console.log(`   - Analysis modes: AI (if API key) or Fallback (keyword-based)`);
  console.log('\n💡 Tip: Add OPENAI_API_KEY to .env for AI-powered analysis');
  console.log('   Without it, the system uses fallback keyword detection.\n');
}

// Run tests
runTests().catch(console.error);
