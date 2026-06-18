"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await signIn("credentials", {
      email, password, redirect: false,
    });
    if (res?.ok) {
      router.push("/");
    } else {
      setError("Invalid email or password.");
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", fontSize: 13,
    fontFamily: "monospace", background: "#0f172a",
    border: "1px solid #1e293b", borderRadius: 8,
    color: "#f1f5f9", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 2px #3b82f620; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>
            🇮🇳 DalalStreet AI
          </div>
          <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
            AI-powered Indian stock market platform
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
            fontSize: 11, padding: "3px 10px", borderRadius: 20,
            background: "#14532d30", border: "1px solid #166534", color: "#86efac",
            fontFamily: "monospace",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#4ade80",
              display: "inline-block", animation: "pulse 1.4s ease infinite",
            }} />
            NSE · BSE · Live data
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#0f172a", border: "1px solid #1e293b",
          borderRadius: 16, padding: 28,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: "#f1f5f9",
            marginBottom: 20, textAlign: "center",
          }}>
            Sign in
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 16, padding: "10px 14px", borderRadius: 8,
              background: "#7f1d1d20", border: "1px solid #7f1d1d",
              color: "#fca5a5", fontSize: 12, fontFamily: "monospace",
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{
                fontSize: 11, color: "#64748b", display: "block",
                marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>Email</label>
              <input
                type="email" required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{
                fontSize: 11, color: "#64748b", display: "block",
                marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>Password</label>
              <input
                type="password" required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6, padding: "12px 0", borderRadius: 8, border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                background: loading ? "#1e3a5f" : "#2563eb",
                color: loading ? "#60a5fa" : "#fff",
                transition: "all 0.15s",
              }}
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e293b",
            fontSize: 11, color: "#334155", textAlign: "center", fontFamily: "monospace",
          }}>
            Secured by NextAuth.js · Sessions expire in 7 days
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#1e293b", fontFamily: "monospace" }}>
          DalalStreet AI · Demo · Virtual Trading Only
        </div>
      </div>
    </div>
  );
}
