import {
  useState,
  type FormEvent,
} from "react";

import {
  useAuth,
} from "../context/AuthContext";

export default function Login() {
  const {
    login,
  } = useAuth();

  // ========================================================
  // FORM STATE
  // ========================================================

  const [email, setEmail] =
    useState(
      "admin@logpulse.com"
    );

  const [
    password,
    setPassword,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  // ========================================================
  // LOGIN SUBMIT
  // ========================================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    try {
      setLoading(true);

      setError("");

      await login(
        email,
        password
      );
    } catch (err) {
      console.error(
        "Login error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">

      <div className="w-full max-w-md">

        {/* LOGO / BRAND */}

        <div className="text-center mb-8">

          <h1 className="text-4xl font-bold">
            🚀 LogPulse
          </h1>

          <p className="text-gray-400 mt-2">
            Real-Time Log Monitoring
          </p>

        </div>

        {/* LOGIN CARD */}

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">

          <div className="mb-6">

            <h2 className="text-2xl font-bold">
              Welcome Back
            </h2>

            <p className="text-gray-400 mt-1">
              Sign in to access your dashboard
            </p>

          </div>

          {/* ERROR */}

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {/* FORM */}

          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-5"
          >

            {/* EMAIL */}

            <div>

              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="admin@logpulse.com"
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 transition"
              />

            </div>

            {/* PASSWORD */}

            <div>

              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Enter your password"
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 transition"
              />

            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-semibold transition ${
                loading
                  ? "bg-emerald-900 text-emerald-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </button>

          </form>

        </div>

        {/* FOOTER */}

        <p className="text-center text-gray-600 text-sm mt-6">
          LogPulse • Distributed Log Monitoring
        </p>

      </div>

    </div>
  );
}
