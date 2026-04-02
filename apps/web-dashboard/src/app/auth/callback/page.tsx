"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, setTokens } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (event === "SIGNED_IN" && session) {
              setStatus("Syncing account...");
              try {
                const response = await api.post("/auth/social", {
                  provider: "oauth",
                }, {
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });

                const { user, tokens } = response.data;
                await setTokens(tokens.accessToken, tokens.refreshToken);

                useAuthStore.setState({
                  user: { ...user, onboardingComplete: user.onboardingComplete ?? false },
                  isAuthenticated: true,
                  isLoading: false,
                });

                subscription.unsubscribe();
                router.push("/dashboard");
              } catch (err) {
                console.error("API sync failed:", err);
                setStatus("Sign in failed. Redirecting...");
                subscription.unsubscribe();
                setTimeout(() => router.push("/login"), 1500);
              }
            }
          }
        );

        setTimeout(() => {
          subscription.unsubscribe();
          if (window.location.pathname === "/auth/callback") {
            setStatus("Timed out. Redirecting...");
            router.push("/login");
          }
        }, 10000);

      } catch (err) {
        console.error("OAuth callback error:", err);
        router.push("/login");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-14 h-14 rounded-full" style={{ border: "2px solid rgba(34, 211, 238, 0.1)" }} />
          <div className="absolute inset-0 w-14 h-14 rounded-full animate-spin" style={{ border: "2px solid transparent", borderTopColor: "var(--accent)", filter: "drop-shadow(0 0 8px rgba(34, 211, 238, 0.4))" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/icon.png" alt="BioPoint" className="w-7 h-7 rounded-lg opacity-80" />
          </div>
        </div>
        <span className="text-sm text-[var(--text-muted)]">{status}</span>
      </div>
    </div>
  );
}
