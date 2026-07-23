// The direct sign-in route. The landing at / is the front door for new
// visitors; this is the bare card the middleware sends a signed-out user to when
// they ask for a gated page directly. Google OAuth is the whole of it.

import { GoogleSignIn } from "@/components/auth/google-sign-in";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col items-center justify-center px-6 text-center">
      {/* alt="" — the <h1> below says "Sign in to Saku"; a non-empty alt would
          flash "Saku" as text before the PNG decodes. */}
      <img
        src="/brand/saku-wordmark.png"
        alt=""
        width={160}
        height={160}
        className="mb-8 h-40 w-40 object-contain"
      />
      <h1 className="text-[20px] font-medium text-text">Sign in to Saku</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
        Sign in to save your progress and pick up on any device.
      </p>
      <GoogleSignIn className="mt-6 w-full" />
      <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-text-muted">
        Signing in is only to remember your progress across devices. We never
        email you anything.
      </p>
    </main>
  );
}
