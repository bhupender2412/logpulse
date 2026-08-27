import {
  API_URL,
  apiClient,
  getApiErrorMessage,
} from "./apiClient";

import {
  getToken,
  removeToken,
  saveToken,
} from "./tokenStorage";

// ==========================================================
// TYPES
// ==========================================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  token: string;
}

export interface MeResponse {
  success: boolean;
  user: AuthUser;
}

// ==========================================================
// LOGIN
// ==========================================================

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResponse> {
  try {
    const response =
      await apiClient.post<LoginResponse>(
        "/api/v1/auth/login",
        {
          email,
          password,
        }
      );

    if (
      !response.data.success ||
      !response.data.token
    ) {
      throw new Error(
        "Invalid login response"
      );
    }

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Login failed"
      )
    );
  }
}

// ==========================================================
// CURRENT USER
// ==========================================================

export async function getCurrentUser(): Promise<MeResponse> {
  if (!getToken()) {
    throw new Error(
      "No authentication token"
    );
  }

  try {
    const response =
      await apiClient.get<MeResponse>(
        "/api/v1/users/me"
      );

    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Unable to fetch user"
      )
    );
  }
}

// ==========================================================
// LOGOUT
// ==========================================================

export function logoutUser(): void {
  removeToken();
}

// ==========================================================
// TEMPORARY COMPATIBILITY
//
// logsApi still uses this.
// ==========================================================

export function getAuthHeaders(): Record<
  string,
  string
> {
  const token =
    getToken();

  if (!token) {
    return {};
  }

  return {
    Authorization:
      `Bearer ${token}`,
  };
}

// ==========================================================
// EXPORTS
// ==========================================================

export {
  API_URL,
  getToken,
  saveToken,
};