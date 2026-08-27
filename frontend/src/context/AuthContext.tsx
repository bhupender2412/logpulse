import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentUser,
  getToken,
  loginUser,
  logoutUser,
  saveToken,
  type AuthUser,
} from "../api/authApi";

import {
  disconnectSocket,
} from "../socket/socket";

// ==========================================================
// AUTH CONTEXT TYPE
// ==========================================================

interface AuthContextType {
  user: AuthUser | null;

  authenticated: boolean;

  loading: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<void>;

  logout: () => void;
}

// ==========================================================
// CONTEXT
// ==========================================================

const AuthContext =
  createContext<
    AuthContextType | undefined
  >(undefined);

// ==========================================================
// PROVIDER PROPS
// ==========================================================

interface AuthProviderProps {
  children: ReactNode;
}

// ==========================================================
// AUTH PROVIDER
// ==========================================================

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthUser | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  // ========================================================
  // RESTORE EXISTING LOGIN SESSION
  // ========================================================

  useEffect(() => {
    const restoreSession =
      async () => {
        try {
          const token =
            getToken();

          // ==================================================
          // NO TOKEN
          // ==================================================

          if (!token) {
            setUser(
              null
            );

            return;
          }

          // ==================================================
          // VALIDATE EXISTING JWT
          // ==================================================

          const response =
            await getCurrentUser();

          setUser(
            response.user
          );
        } catch (error) {
          console.error(
            "Restore session error:",
            error
          );

          // ==================================================
          // INVALID / EXPIRED TOKEN
          // ==================================================

          disconnectSocket();

          logoutUser();

          setUser(
            null
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    void restoreSession();
  }, []);

  // ========================================================
  // HANDLE GLOBAL 401 / EXPIRED JWT
  //
  // apiClient dispatches:
  //
  // auth:unauthorized
  //
  // whenever a protected request returns HTTP 401.
  // ========================================================

  useEffect(() => {
    const handleUnauthorized =
      () => {
        console.warn(
          "⚠️ Authentication expired"
        );

        disconnectSocket();

        logoutUser();

        setUser(
          null
        );

        setLoading(
          false
        );
      };

    window.addEventListener(
      "auth:unauthorized",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "auth:unauthorized",
        handleUnauthorized
      );
    };
  }, []);

  // ========================================================
  // LOGIN
  // ========================================================

  const login = async (
    email: string,
    password: string
  ) => {
    const response =
      await loginUser(
        email,
        password
      );

    // ======================================================
    // SAVE JWT
    // ======================================================

    saveToken(
      response.token
    );

    // ======================================================
    // SAVE USER
    // ======================================================

    setUser(
      response.user
    );
  };

  // ========================================================
  // LOGOUT
  // ========================================================

  const logout = () => {
    // ======================================================
    // CLOSE AUTHENTICATED SOCKET
    // ======================================================

    disconnectSocket();

    // ======================================================
    // REMOVE JWT
    // ======================================================

    logoutUser();

    // ======================================================
    // CLEAR USER
    // ======================================================

    setUser(
      null
    );
  };

  // ========================================================
  // PROVIDER
  // ========================================================

  return (
    <AuthContext.Provider
      value={{
        user,

        authenticated:
          Boolean(
            user
          ),

        loading,

        login,

        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ==========================================================
// AUTH HOOK
// ==========================================================

export function useAuth(): AuthContextType {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}