# ⚠️ Image Upload Issue on Render

## Problem
Images uploaded to the Render deployment are **not persisting** and appear broken.

## Root Cause
Render uses **ephemeral storage** for free tier deployments. This means:
- Files uploaded to `/uploads` folder are stored temporarily
- When the container restarts (every deploy, or after inactivity), all uploaded files are **deleted**
- This is standard behavior for containerized hosting platforms

## Solutions

### ✅ Option 1: Cloudinary (Recommended - Free Tier Available)

**Why Cloudinary?**
- Free tier: 25GB storage, 25GB bandwidth/month
- Automatic image optimization
- CDN delivery (fast worldwide)
- Easy integration with Node.js

**Implementation:**

1. **Install Cloudinary:**
```bash
cd backend
npm install cloudinary multer-storage-cloudinary
```

2. **Update `.env`:**
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

3. **Update `server.js`:**
```javascript
import cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Replace multer diskStorage with CloudinaryStorage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'emotionally-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp3', 'wav', 'm4a'],
    resource_type: 'auto' // Handles images and audio
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// No need for app.use('/uploads', ...) - Cloudinary URLs are direct
```

4. **Update image URL handling:**
```javascript
// In post creation, Cloudinary returns full URLs
const images = (req.files?.images || []).map(f => f.path); // f.path is Cloudinary URL
```

**Sign up:** https://cloudinary.com/users/register/free

---

### Option 2: AWS S3 (More Complex, Free Tier for 12 months)

**Implementation:**
```bash
npm install aws-sdk multer-s3
```

Configure similar to Cloudinary but with S3 credentials.

---

### Option 3: Temporary Fix - Keep Using Render Storage

**For testing purposes only:**
- Upload images through the deployed app
- They will work until next deploy/restart
- Not suitable for production

**Workaround:**
- Keep important images in git (not recommended for user uploads)
- Re-upload after each deploy (tedious)

---

## Current Status

**Backend (Render):**
- ✅ Upload endpoint working
- ✅ Files saved to `/uploads` temporarily
- ❌ Files lost on container restart
- ⚠️ Need to implement Cloudinary

**Frontend (Vercel):**
- ✅ Working correctly
- ✅ Sends images to backend
- ⚠️ Fetches from ephemeral storage

---

## Immediate Action Required

**To fix image persistence:**
1. Sign up for Cloudinary (5 minutes)
2. Install packages (1 minute)
3. Update `server.js` storage config (10 minutes)
4. Add env vars to Render (2 minutes)
5. Redeploy (auto)

**Estimated time:** 20-30 minutes to fully fix

---

## Testing Checklist

After implementing Cloudinary:
- [ ] Upload image through deployed app
- [ ] Verify image URL is `https://res.cloudinary.com/...`
- [ ] Restart Render service manually
- [ ] Verify image still loads (persistence test)
- [ ] Check Cloudinary dashboard for uploaded files

---

## Additional Benefits of Cloudinary

1. **Automatic Optimization:** Images compressed without quality loss
2. **Transformations:** Resize, crop, filter on-the-fly
3. **Responsive Images:** Different sizes for mobile/desktop
4. **Video Support:** Can handle video uploads too
5. **Analytics:** Track storage usage and bandwidth

---

**Priority:** HIGH - Required for production use
**Complexity:** LOW - Simple integration
**Cost:** FREE for typical usage (25GB storage)
