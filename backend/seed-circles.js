// Seed initial support circles
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

const { MONGO_URI } = process.env;

const circleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  icon: String,
  color: { type: String, default: '#8B5CF6' },
  memberCount: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const Circle = mongoose.model('Circle', circleSchema);

const initialCircles = [
  {
    name: 'Grief & Loss',
    slug: 'grief-loss',
    description: 'A safe space for those navigating the pain of losing someone or something dear',
    icon: '🕊️',
    color: '#6B7280'
  },
  {
    name: 'Heartbreak & Love',
    slug: 'heartbreak-love',
    description: 'Share your stories of love lost, healing hearts, and finding yourself again',
    icon: '💔',
    color: '#EF4444'
  },
  {
    name: 'Anxiety & Fear',
    slug: 'anxiety-fear',
    description: 'Together we face our fears and support each other through anxious times',
    icon: '🌪️',
    color: '#F59E0B'
  },
  {
    name: 'Depression & Darkness',
    slug: 'depression-darkness',
    description: 'You are not alone in the darkness. Share your struggles and find light together',
    icon: '🌑',
    color: '#1F2937'
  },
  {
    name: 'New Beginnings',
    slug: 'new-beginnings',
    description: 'Celebrating fresh starts, life transitions, and the courage to begin again',
    icon: '🌱',
    color: '#10B981'
  },
  {
    name: 'Family Struggles',
    slug: 'family-struggles',
    description: 'Navigate complex family relationships and find understanding',
    icon: '👨‍👩‍👧‍👦',
    color: '#8B5CF6'
  },
  {
    name: 'Career & Purpose',
    slug: 'career-purpose',
    description: 'Finding meaning, dealing with work stress, and discovering your path',
    icon: '🎯',
    color: '#3B82F6'
  },
  {
    name: 'Self-Discovery',
    slug: 'self-discovery',
    description: 'The journey of understanding yourself, your identity, and your truth',
    icon: '🔍',
    color: '#EC4899'
  },
  {
    name: 'Healing & Growth',
    slug: 'healing-growth',
    description: 'Share your healing journey and celebrate personal growth',
    icon: '🦋',
    color: '#14B8A6'
  },
  {
    name: 'Loneliness & Connection',
    slug: 'loneliness-connection',
    description: 'For those feeling alone and seeking genuine human connection',
    icon: '🤝',
    color: '#6366F1'
  }
];

async function seedCircles() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing circles
    await Circle.deleteMany({});
    console.log('🗑️  Cleared existing circles');

    // Insert new circles
    await Circle.insertMany(initialCircles);
    console.log(`✅ Created ${initialCircles.length} circles`);

    console.log('\n📊 Circles created:');
    initialCircles.forEach(c => {
      console.log(`   ${c.icon} ${c.name} (/${c.slug})`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seedCircles();
