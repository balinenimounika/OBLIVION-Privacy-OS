import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Storage token key
export const TOKEN_STORAGE_KEY = 'oblivion_auth_token';

// In-memory token cache (synced with storage for development persistence)
let currentToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);

export function setAuthToken(token: string | null): void {
  currentToken = token;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getAuthToken(): string | null {
  if (!currentToken) {
    currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return currentToken;
}

// Request Interceptor: Attach Bearer JWT
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Custom event to notify app on unauthorized access (e.g. token expired / account deactivated)
export const AUTH_EXPIRED_EVENT = 'oblivion_auth_expired';

// Response Interceptor: Standardize API responses & errors
apiClient.interceptors.response.use(
  (response) => {
    // Return the response directly
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        // Token expired or invalid
        setAuthToken(null);
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: data?.message || 'Session expired' }));
      } else if (status === 403) {
        // Deactivated or suspended account
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: data?.message || 'Access forbidden' }));
      }
    } else if (error.request) {
      // Network error (server offline / connection refused)
      console.error('[API Network Error] Could not connect to OBLIVION backend server at', API_BASE_URL);
    }
    return Promise.reject(error);
  }
);
