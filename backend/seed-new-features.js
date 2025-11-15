import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const { MONGO_URI } = process.env;

// Define schemas (same as in server.js)
const moodEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mood: { 
    type: String, 
    enum: ['happy', 'neutral', 'sad', 'anxious', 'angry', 'excited', 'peaceful', 'overwhelmed'],
    required: true 
  },
  intensity: { type: Number, min: 1, max: 10, required: true },
  note: { type: String, maxlength: 500 },
  activities: [String],
  triggers: [String],
  aiInsight: String,
  createdAt: { type: Date, default: Date.now }
});
const MoodEntry = mongoose.model('MoodEntry', moodEntrySchema);

const heartGiftSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  message: { type: String, maxlength: 200 },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  createdAt: { type: Date, default: Date.now }
});
const HeartGift = mongoose.model('HeartGift', heartGiftSchema);

const writingStreakSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastPostDate: Date,
  streakDates: [Date],
  totalPosts: { type: Number, default: 0 },
  badges: [{ 
    type: { type: String },
    earnedAt: Date 
  }],
  updatedAt: { type: Date, default: Date.now }
});
const WritingStreak = mongoose.model('WritingStreak', writingStreakSchema);

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String, select: false },
  hearts: { type: Number, default: 5 },
  avatar: String,
  favoriteWriters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  circles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Circle' }],
  heartsGifted: { type: Number, default: 0 },
  heartsReceived: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
  emotion: String,
  author: String,
  title: String,
  excerpt: String,
  content: String,
  cost: Number,
  free: Boolean,
  images: [String],
  createdAt: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, username: String, text: String, createdAt: { type: Date, default: Date.now } }],
  reactions: {
    empathy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    support: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    strength: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hope: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  voiceNote: {
    audioUrl: String,
    duration: Number,
    transcript: String
  }
});
const Post = mongoose.model('Post', postSchema);

async function seedNewFeatures() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get first user from database
    const users = await User.find().limit(5);
    if (users.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      process.exit(1);
    }

    const testUser = users[0];
    const otherUser = users[1] || testUser;
    console.log(`📝 Using test user: ${testUser.username} (${testUser._id})`);

    // 1. Seed Mood Entries (last 7 days)
    console.log('\n🧠 Seeding mood entries...');
    const moods = ['happy', 'neutral', 'sad', 'anxious', 'excited', 'peaceful', 'overwhelmed'];
    const moodEntries = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      moodEntries.push({
        userId: testUser._id,
        mood: moods[i % moods.length],
        intensity: Math.floor(Math.random() * 5) + 5, // 5-10
        note: [
          'Had a great day at work!',
          'Feeling a bit overwhelmed with everything.',
          'Nice quiet evening, just what I needed.',
          'Stressed about upcoming deadlines.',
          'Great progress on my goals today!',
          'Missing someone special.',
          'Feeling grateful for the little things.'
        ][i],
        activities: i % 2 === 0 ? ['work', 'exercise'] : ['relaxing', 'socializing'],
        triggers: i % 3 === 0 ? ['work', 'deadlines'] : ['family', 'health'],
        createdAt: date
      });
    }

    await MoodEntry.deleteMany({ userId: testUser._id });
    await MoodEntry.insertMany(moodEntries);
    console.log(`✅ Created ${moodEntries.length} mood entries`);

    // 2. Add reactions to existing posts
    console.log('\n💙 Adding reactions to posts...');
    const posts = await Post.find().limit(10);
    
    for (const post of posts) {
      if (!post.reactions) {
        post.reactions = { empathy: [], support: [], strength: [], hope: [] };
      }
      
      // Add random reactions from different users
      const reactionTypes = ['empathy', 'support', 'strength', 'hope'];
      for (let i = 0; i < Math.min(users.length, 3); i++) {
        const randomType = reactionTypes[Math.floor(Math.random() * reactionTypes.length)];
        if (!post.reactions[randomType].includes(users[i]._id)) {
          post.reactions[randomType].push(users[i]._id);
        }
      }
      
      await post.save();
    }
    console.log(`✅ Added reactions to ${posts.length} posts`);

    // 3. Seed Heart Gifts
    console.log('\n💝 Seeding heart gifts...');
    await HeartGift.deleteMany({ 
      $or: [
        { fromUserId: testUser._id },
        { toUserId: testUser._id }
      ]
    });

    const gifts = [
      {
        fromUserId: otherUser._id,
        toUserId: testUser._id,
        amount: 3,
        message: 'Your post really helped me today. Thank you! 💙',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        fromUserId: otherUser._id,
        toUserId: testUser._id,
        amount: 5,
        message: 'You\'re such an inspiration! Keep writing!',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      }
    ];

    if (posts.length > 0) {
      gifts.push({
        fromUserId: otherUser._id,
        toUserId: testUser._id,
        amount: 2,
        message: 'This post touched my heart 🌟',
        postId: posts[0]._id,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
      });
    }

    await HeartGift.insertMany(gifts);
    console.log(`✅ Created ${gifts.length} heart gifts`);

    // 4. Seed Writing Streaks
    console.log('\n🔥 Seeding writing streaks...');
    
    // Delete existing streak
    await WritingStreak.deleteMany({ userId: testUser._id });

    const streakDates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      streakDates.push(date);
    }

    const streak = new WritingStreak({
      userId: testUser._id,
      currentStreak: 5,
      longestStreak: 12,
      lastPostDate: new Date(),
      streakDates: streakDates,
      totalPosts: 27,
      badges: [
        { type: '7-day', earnedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }
      ]
    });

    await streak.save();
    console.log(`✅ Created writing streak: ${streak.currentStreak} day streak!`);

    // 5. Update user with received hearts count
    console.log('\n💗 Updating user stats...');
    testUser.heartsReceived = gifts.reduce((sum, g) => sum + g.amount, 0);
    await testUser.save();
    console.log(`✅ User now has ${testUser.heartsReceived} hearts received`);

    console.log('\n🎉 All test data seeded successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - ${moodEntries.length} mood entries (last 7 days)`);
    console.log(`   - Reactions added to ${posts.length} posts`);
    console.log(`   - ${gifts.length} heart gifts`);
    console.log(`   - 1 writing streak (${streak.currentStreak} days, ${streak.badges.length} badges)`);
    
    console.log('\n✨ You can now test:');
    console.log('   - Visit /moods to see mood history and generate AI insights');
    console.log('   - Check posts for reaction buttons (💙 🤗 💪 🌟)');
    console.log('   - API: GET /api/gifts/received to see heart gifts');
    console.log('   - API: GET /api/streaks/my to see writing streak');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedNewFeatures();
