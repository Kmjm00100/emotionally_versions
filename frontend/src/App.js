import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import HomePage from "./pages/HomePage";
import WritePage from "./components/WritePage";
import HeartsPage from "./pages/HeartsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import TradePage from "./pages/TradePage";
import SearchPage from "./pages/SearchPage";
import ProfileEditPage from "./pages/ProfileEditPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const { token } = useAuth();
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={token ? <HomePage /> : <Navigate to="/login" replace />} />
        <Route path="/write" element={<ProtectedRoute><WritePage /></ProtectedRoute>} />
        <Route path="/hearts" element={<ProtectedRoute><HeartsPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditPage /></ProtectedRoute>} />
        <Route path="/trade" element={<ProtectedRoute><TradePage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}
