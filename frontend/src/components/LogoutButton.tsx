"use client";
import { signOut, useSession } from "next-auth/react";

export default function LogoutButton() {
  const { data: session } = useSession();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {session?.user?.name && (
        <span style={{
          fontSize: 11, color: "#64748b", fontFamily: "monospace",
        }}>
          👤 {session.user.name}
        </span>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        style={{
          padding: "4px 12px", borderRadius: 6, border: "none",
          cursor: "pointer", fontSize: 11, fontWeight: 600,
          fontFamily: "monospace",
          background: "#7f1d1d30",
          color: "#fca5a5",
          transition: "all 0.15s",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
