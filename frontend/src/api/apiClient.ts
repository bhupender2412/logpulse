import axios from "axios";

import {
  getToken,
  removeToken,
} from "./tokenStorage";

// ==========================================================
// API URL
// ==========================================================

export const API_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  "http://localhost:4000";

// ==========================================================
// AXIOS CLIENT
// ==========================================================

export const apiClient =
  axios.create({
    baseURL:
      API_URL,

    timeout:
      15000,

    headers: {
      "Content-Type":
        "application/json",
    },
  });

// ==========================================================
// JWT REQUEST INTERCEPTOR
// ==========================================================

apiClient.interceptors.request.use(
  (config) => {
    const token =
      getToken();

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  }
);

// ==========================================================
// UNAUTHORIZED RESPONSE HANDLER
// ==========================================================

apiClient.interceptors.response.use(
  (response) =>
    response,

  (error) => {
    if (
      error.response?.status ===
      401 &&
      getToken()
    ) {
      removeToken();

      window.dispatchEvent(
        new Event(
          "auth:unauthorized"
        )
      );
    }

    return Promise.reject(
      error
    );
  }
);

// ==========================================================
// API ERROR MESSAGE
// ==========================================================

export function getApiErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    axios.isAxiosError(
      error
    )
  ) {
    const data =
      error.response?.data as
        | {
            error?: string;
            message?: string;
          }
        | undefined;

    return (
      data?.error ||
      data?.message ||
      error.message ||
      fallback
    );
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return fallback;
}