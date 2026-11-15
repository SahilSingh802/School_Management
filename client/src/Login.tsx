
import { useState } from "react";
import axios from "axios";
import api from "./services/api";
import {
  GraduationCap, Mail, Lock, Eye, EyeOff,
  ArrowRight, ShieldCheck
} from "lucide-react";

interface LoginProps {
  onLogin: (token: string, user: LoginUser) => void;
}

export interface LoginUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "GUARDIAN";
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error("Invalid login response from server.");
      }

      localStorage.setItem("edu_token", token);
      localStorage.setItem("edu_user", JSON.stringify(user));

      onLogin(token, user);
    } catch (err: unknown) {
      setError(
        (axios.isAxiosError(err) && err.response?.data?.message) ||
        (err instanceof Error && err.message) ||
        "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Branding Panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#151B35] p-12 text-white lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600">
            <GraduationCap size={27} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">EduSphere</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">
              School Management
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-2 text-xs text-indigo-200">
            <ShieldCheck size={15} />
            Smart School Management Platform
          </div>

          <h2 className="text-5xl font-extrabold leading-tight tracking-tight">
            Empowering
            <span className="block text-indigo-400">Education.</span>
            Simplifying
            <span className="block">Management.</span>
          </h2>

          <p className="mt-6 max-w-md text-sm leading-7 text-slate-400">
            One platform to manage students, teachers, attendance,
            examinations and school finances — all in one place.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-5 border-t border-slate-700 pt-7">
            <div>
              <h3 className="text-2xl font-bold">Smart</h3>
              <p className="mt-1 text-xs text-slate-400">Management</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Secure</h3>
              <p className="mt-1 text-xs text-slate-400">Access</p>
            </div>
            <div>
              <h3 className="text-2xl font-bold">Simple</h3>
              <p className="mt-1 text-xs text-slate-400">Experience</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © 2026 EduSphere. All rights reserved.
        </p>
      </div>

      {/* Login Form */}
      <div className="flex flex-1 items-center justify-center bg-[#F7F8FC] px-5 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <GraduationCap size={24} />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">EduSphere</h1>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-10">
            <div className="mb-8">
              <p className="text-sm font-semibold text-indigo-600">
                WELCOME BACK
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                Sign in to your account
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your credentials to access your school workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  Email Address
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@school.com"
                    className="w-full bg-transparent px-3 py-3.5 text-sm outline-none"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  Password
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50">
                  <Lock size={18} className="text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-transparent px-3 py-3.5 text-sm outline-none"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-indigo-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-medium leading-5 text-rose-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck size={15} className="text-emerald-500" />
              Secure authentication powered by EduSphere
            </div>
          </div>

          <p className="mt-7 text-center text-xs text-slate-400">
            Having trouble signing in? Contact your school administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
