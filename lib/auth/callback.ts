import type { AuthError, Session } from "@supabase/supabase-js";

type AuthCallbackDeps = {
  supabase: {
    auth: {
      exchangeCodeForSession: (code: string) => Promise<{ error: AuthError | null }>;
      getSession: () => Promise<{ data: { session: Session | null } }>;
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
  let session: Session | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus("Sign-in failed. Try again from the homepage.");
        return;
      }
      session = data.session;
    }
  }

  if (!session) {
    const { data } = await supabase.auth.getSession();
    session = data.session;
  }

  if (!session) {
    setStatus("No session found. Try signing in again.");
    return;
  }

  setStatus("Signed in. Redirecting...");
  replace("/");
}
