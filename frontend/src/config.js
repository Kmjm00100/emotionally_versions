// Backend API Configuration
// For local development, use localhost
export const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://emotionally-versions.onrender.com'
  : 'http://localhost:5000';
