import axios, { AxiosInstance } from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useRef } from "react";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

// Export a hook to use the API with auth
export const useApi = (): AxiosInstance => {
  const { getToken } = useAuth();
  const apiRef = useRef<AxiosInstance | null>(null);

  // Create axios instance only once
  if (!apiRef.current) {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add auth token
    const interceptorId = instance.interceptors.request.use(
      async (config) => {
        try {
          const token = await getToken();
          console.log("Token retrieved:", token ? "✓" : "✗");
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log("Authorization header set");
          } else {
            console.warn("No token available");
          }
        } catch (error) {
          console.error("Error getting token:", error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    apiRef.current = instance;
  }

  return apiRef.current;
};
