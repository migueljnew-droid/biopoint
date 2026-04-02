"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, setTokens } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase handles the OAuth code exchange automatically from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.error("OAuth callback error:", error);
          router.push("/login");
          return;
        }

        // Sync Supabase user with our API — get our custom JWT tokens
        const response = await api.post("/auth/social", {
          provider: "oauth",
        }, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const { user, tokens } = response.data;
        await setTokens(tokens.accessToken, tokens.refreshToken);

        // Update auth store
        useAuthStore.setState({
          user: { ...user, onboardingComplete: user.onboardingComplete ?? false },
          isAuthenticated: true,
          isLoading: false,
        });

        router.push("/dashboard");
      } catch (err) {
        console.error("OAuth callback failed:", err);
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
        <span className="text-sm text-[var(--text-muted)]">Completing sign in...</span>
      </div>
    </div>
  );
}
