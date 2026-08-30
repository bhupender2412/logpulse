import {
  useState,
  type FormEvent,
} from "react";

import {
  Eye,
  LogIn,
} from "lucide-react";

import {
  useAuth,
} from "../context/AuthContext";

// ==========================================================
// DEMO ACCOUNT
//
// This account is intentionally public and read-only.
// Backend role protection remains the real security layer.
// ==========================================================

const DEMO_EMAIL =
  "demo@pulseengine.dev";

const DEMO_PASSWORD =
  "Demo@12345";

// ==========================================================
// LOGIN PAGE
// ==========================================================

export default function Login() {
  const {
    login,
  } =
    useAuth();

  // ========================================================
  // FORM STATE
  // ========================================================

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    demoLoading,
    setDemoLoading,
  ] =
    useState(false);

  // ========================================================
  // NORMAL LOGIN
  // ========================================================

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      try {
        setLoading(
          true
        );

        setError(
          ""
        );

        await login(
          email.trim(),
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
        setLoading(
          false
        );
      }
    };

  // ========================================================
  // DEMO LOGIN
  // ========================================================

  const handleDemoLogin =
    async () => {
      try {
        setDemoLoading(
          true
        );

        setError(
          ""
        );

        await login(
          DEMO_EMAIL,
          DEMO_PASSWORD
        );
      } catch (err) {
        console.error(
          "Demo login error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Demo login failed"
        );
      } finally {
        setDemoLoading(
          false
        );
      }
    };

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">

      <div className="w-full max-w-md">

        {/* ==================================================
            BRAND
        ================================================== */}

        <div className="text-center mb-8">

          <h1 className="text-4xl font-bold tracking-tight">
            PulseEngine
          </h1>

          <p className="text-zinc-500 mt-3">
            Reliable Webhook Delivery and Monitoring
          </p>

        </div>

        {/* ==================================================
            LOGIN CARD
        ================================================== */}

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-7 sm:p-8 shadow-2xl">

          {/* ================================================
              HEADER
          ================================================ */}

          <div className="mb-6">

            <h2 className="text-2xl font-bold">
              Sign In
            </h2>

            <p className="text-zinc-500 mt-1">
              Access the PulseEngine monitoring console.
            </p>

          </div>

          {/* ================================================
              ERROR
          ================================================ */}

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* ================================================
              LOGIN FORM
          ================================================ */}

          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-5"
          >

            {/* ==============================================
                EMAIL
            ============================================== */}

            <div>

              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={
                  email
                }
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="you@example.com"
                disabled={
                  loading ||
                  demoLoading
                }
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 disabled:opacity-60 transition"
              />

            </div>

            {/* ==============================================
                PASSWORD
            ============================================== */}

            <div>

              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Enter your password"
                disabled={
                  loading ||
                  demoLoading
                }
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 disabled:opacity-60 transition"
              />

            </div>

            {/* ==============================================
                SIGN IN
            ============================================== */}

            <button
              type="submit"
              disabled={
                loading ||
                demoLoading
              }
              className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                loading ||
                demoLoading
                  ? "bg-emerald-900 text-emerald-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >

              <LogIn
                size={
                  17
                }
              />

              {loading
                ? "Signing in..."
                : "Sign In"}

            </button>

          </form>

          {/* ================================================
              DIVIDER
          ================================================ */}

          <div className="flex items-center gap-4 my-6">

            <div className="h-px flex-1 bg-zinc-800" />

            <span className="text-xs text-zinc-600 uppercase tracking-[0.18em]">
              or
            </span>

            <div className="h-px flex-1 bg-zinc-800" />

          </div>

          {/* ================================================
              DEMO LOGIN
          ================================================ */}

          <button
            type="button"
            onClick={() =>
              void handleDemoLogin()
            }
            disabled={
              loading ||
              demoLoading
            }
            className="w-full py-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >

            <Eye
              size={
                17
              }
            />

            {demoLoading
              ? "Opening Demo..."
              : "Try Live Demo"}

          </button>

          {/* ================================================
              DEMO INFORMATION
          ================================================ */}

          <div className="mt-5 p-4 bg-black border border-zinc-800 rounded-xl">

            <p className="text-sm text-zinc-300 font-medium">
              Explore without an account
            </p>

            <p className="text-sm text-zinc-500 mt-1 leading-6">
              The demo contains preloaded projects, webhook
              events, delivery failures, retries and analytics.
            </p>

            <div className="mt-3 flex items-center gap-2">

              <span className="inline-flex px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] uppercase font-semibold tracking-wide">
                Read Only
              </span>

              <span className="text-xs text-zinc-600">
                Administrative actions are disabled
              </span>

            </div>

          </div>

        </div>

        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="text-center mt-6">

          <p className="text-zinc-700 text-sm">
            PulseEngine
          </p>

          <p className="text-zinc-800 text-xs mt-1">
            Asynchronous Webhook Delivery Platform
          </p>

        </div>

      </div>

    </div>
  );
}