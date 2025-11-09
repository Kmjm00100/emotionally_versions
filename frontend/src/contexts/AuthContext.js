import React, { createContext, useContext, useState } from "react";
const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("emo_user") || "null"));
  const [token, setToken] = useState(() => localStorage.getItem("emo_token"));
  const login = (data) => {
    setUser({ username: data.username, hearts: data.hearts, userId: data.userId });
    setToken(data.token);
    localStorage.setItem("emo_user", JSON.stringify({ username: data.username, hearts: data.hearts, userId: data.userId }));
    localStorage.setItem("emo_token", data.token);
  };
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("emo_user");
    localStorage.removeItem("emo_token");
  };
  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

