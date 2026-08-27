import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

function AppContent() {
  const {
    authenticated,
    loading,
  } = useAuth();

  // ========================================================
  // CHECK SESSION
  // ========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">

        <div className="text-center">

          <div className="text-4xl mb-4">
            🚀
          </div>

          <p className="text-gray-400">
            Loading LogPulse...
          </p>

        </div>

      </div>
    );
  }

  // ========================================================
  // NOT LOGGED IN
  // ========================================================

  if (!authenticated) {
    return <Login />;
  }

  // ========================================================
  // LOGGED IN
  // ========================================================

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}