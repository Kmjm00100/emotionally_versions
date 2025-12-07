# Emotionally - Deployment Guide

This guide will help you deploy the Emotionally app with frontend on Vercel and backend on Render.

## Prerequisites

- GitHub account
- Vercel account (sign up at https://vercel.com)
- Render account (sign up at https://render.com)
- MongoDB Atlas account (for database)

---

## 🎨 Frontend Deployment (Vercel)

### Step 1: Push Frontend to GitHub
The frontend is already in the repository: `https://github.com/Kmjm00100/emotionally_frontend.git`

### Step 2: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository: `Kmjm00100/emotionally_frontend`
4. Configure the project:
   - **Framework Preset**: Create React App
   - **Root Directory**: `./` (or leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. Add Environment Variables:
   - Click **"Environment Variables"**
   - Add:   ` = `https://your-backend-url.onrender.com`
   - (You'll get the backend URL after deploying to Render)

6. Click **"Deploy"**

### Step 3: Get Your Vercel URL
After deployment, you'll get a URL like: `https://your-app-name.vercel.app`

---

## 🚀 Backend Deployment (Render)

### Step 1: Prepare Backend Repository

First, let's create a separate backend repository or use the main repository with backend folder.

### Step 2: Deploy to Render

1. Go to [Render Dashboard](https://render.com/dashboard)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `emotionally-backend` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `version_1.0` (or your main branch)
   - **Root Directory**: `backend` (if using monorepo)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

5. Add Environment Variables:
   Click **"Advanced"** → **"Add Environment Variable"**
   
   Add these variables:
   ```
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/emotionally?retryWrites=true&w=majority
   JWT_SECRET=your-super-secret-jwt-key-here-use-a-long-random-string
   AI_PROVIDER=groq
   GROQ_API_KEY=your-groq-api-key-here
   PORT=5000
   ```

6. Click **"Create Web Service"**

### Step 3: Get Your Render URL
After deployment, you'll get a URL like: `https://emotionally-backend.onrender.com`

---

## 🔄 Update Frontend with Backend URL

1. Go back to Vercel Dashboard
2. Select your project
3. Go to **"Settings"** → **"Environment Variables"**
4. Update `REACT_APP_API` with your Render backend URL:
   ```
   REACT_APP_API=https://emotionally-backend.onrender.com
   ```
5. Go to **"Deployments"** → Click **"..."** → **"Redeploy"**

---

## 🗄️ MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Get your connection string
5. Replace `<username>`, `<password>`, and `<cluster>` in the MONGO_URI
6. Add your Render IP to the IP Whitelist (or use `0.0.0.0/0` to allow all)

---

## ✅ Final Steps

1. Test your backend: `https://your-backend.onrender.com/api/posts`
2. Test your frontend: `https://your-app.vercel.app`
3. Try logging in and creating posts

---

## 🐛 Troubleshooting

### Backend Issues:
- Check Render logs: Dashboard → Your Service → "Logs"
- Verify environment variables are set correctly
- Make sure MongoDB connection string is correct

### Frontend Issues:
- Check Vercel deployment logs
- Verify `REACT_APP_API` environment variable
- Check browser console for CORS errors

### CORS Errors:
If you get CORS errors, make sure your backend `server.js` has:
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'https://your-app.vercel.app',
  credentials: true
}));
```

---

## 📝 Notes

- **Free Tier Limitations**:
  - Render free tier: Service sleeps after 15 minutes of inactivity (first request may be slow)
  - Vercel: 100GB bandwidth per month
  - MongoDB Atlas: 512MB storage

- **Custom Domains**:
  - Both Vercel and Render support custom domains
  - Configure in respective dashboards

---

## 🎉 Your App is Live!

Frontend: `https://your-app.vercel.app`
Backend: `https://your-backend.onrender.com`

Share your emotional stories with the world! 💜
