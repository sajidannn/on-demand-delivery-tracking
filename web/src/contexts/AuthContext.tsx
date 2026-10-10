import { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../lib/api/client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "DRIVER";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const { data, error } = await apiClient.GET("/auth/me");
      if (data && !error) {
        setUser(data as User);
      } else {
        setUser(null);
      }
    } catch (_err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    // Listen to unauthorized event from apiClient
    const handleUnauthorized = () => {
      setUser(null);
    };
    
    if (typeof window !== "undefined") {
      window.addEventListener("auth:unauthorized", handleUnauthorized);
      return () => {
        window.removeEventListener("auth:unauthorized", handleUnauthorized);
      };
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    await apiClient.POST("/auth/logout", {
      body: {}, // empty body for logout
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
