import { useEffect, useState, type FormEvent } from "react";
import App from "./App";
import {
  API_URL,
  clearSession,
  getToken,
  saveSession,
} from "./api";

type User = {
  id: string;
  name: string;
  email: string;
  role: "FINANCE_EXECUTIVE" | "CO_FOUNDER";
};

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("finance@settleflow.demo");
  const [password, setPassword] = useState("Finance@123");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function restoreSession() {
      const token = getToken();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error("Session expired");
        }

        setUser(data.user);
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      saveSession(data.token, data.user);
      setUser(data.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to log in"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    clearSession();
    setUser(null);
    setPassword("");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Restoring session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white">
              S
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              SettleFlow
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Settlement reconciliation and financial operations.
            </p>
          </div>

          <form onSubmit={login} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Work email
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-slate-900 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            <p className="mb-2 font-semibold text-slate-700">
              Demo accounts
            </p>
            <p>Finance: finance@settleflow.demo / Finance@123</p>
            <p className="mt-1">
              Co-founder: founder@settleflow.demo / Founder@123
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-5 py-2">
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-800">
            {user.name}
          </p>
          <p className="text-[11px] text-slate-500">
            {user.role === "CO_FOUNDER"
              ? "Co-founder"
              : "Finance Executive"}
          </p>
        </div>

        <button
          onClick={logout}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>

      <App />
    </div>
  );
}