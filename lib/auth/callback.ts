import type { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthCallbackDeps = {
  supabase: {
    auth: {
      exchangeCodeForSession: (code: string) => Promise<{ error: unknown | null }>;
      getSession: () => Promise<{ data: { session: unknown | null } }>;
    };
  };
  currentUrl: string;
  setStatus: (message: string) => void;
  replace: (path: string) => void;
};

export async function completeAuthCallback({
  supabase,
  currentUrl,
  setStatus,
  replace
}: AuthCallbackDeps) {
  const url = new URL(currentUrl);
  const code = url.searchParams.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      setStatus("Sign-in failed. Try again from the homepage.");
      return;
    }
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    setStatus("No session found. Try signing in again.");
    return;
  }

  setStatus("Signed in. Redirecting...");
  replace("/");
}
