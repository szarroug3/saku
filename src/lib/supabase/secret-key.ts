import "server-only";

// The server-only half of the publishable/secret key migration — see
// ./keys.ts for the full explanation. Kept in its OWN file, separately
// guarded, so nothing that reads the full-access secret key can end up in a
// client bundle the way the publishable-key equivalent safely can.

/** The full-access key. Bypasses Row Level Security; never expose it to a
 * client. */
export function supabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY;
}
