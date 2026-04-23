import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    const token = localStorage.getItem("salon_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch {
      localStorage.removeItem("salon_token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (username, password) => {
    const r = await api.post("/auth/login", { username, password });
    localStorage.setItem("salon_token", r.data.token);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("salon_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
