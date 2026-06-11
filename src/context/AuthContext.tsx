import React, { createContext, useContext, useState, useEffect } from "react";
import { authService, User } from "../services/authService";
import { apiClient } from "../services/apiClient";
import { io, Socket } from "socket.io-client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  socket: Socket | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const refreshUser = async () => {
    try {
      const u = await authService.getMe();
      setUser(u);
    } catch (error) {
      setUser(null);
      apiClient.clearAccessToken();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = apiClient.getAccessToken();
      if (token) {
        await refreshUser();
      }
      setLoading(false);
    };

    initAuth();

    // Listen to global logout events from apiClient
    const handleGlobalLogout = () => {
      setUser(null);
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
    window.addEventListener("auth-logout", handleGlobalLogout);
    return () => {
      window.removeEventListener("auth-logout", handleGlobalLogout);
    };
  }, []);

  // Socket setup based on logged-in user
  useEffect(() => {
    if (user) {
      const newSocket = io(window.location.origin, {
        transports: ["websocket"],
      });

      newSocket.on("connect", () => {
        console.log("[Socket] Connected to server");
        newSocket.emit("join", user._id);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
        setSocket(null);
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [user?._id]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const u = await authService.login(email, password);
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    try {
      const u = await authService.register(email, password, displayName);
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, socket }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
