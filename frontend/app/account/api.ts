// Typed bridge to the account commands in backend/src/account/.
import { invoke } from "@tauri-apps/api/core";

export type Provider = "discord" | "google";

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** "discord" or "google", as Supabase reports it. */
  provider: string | null;
}

export const accountApi = {
  profile: () => invoke<Profile | null>("account_profile"),
  /** Resolves once the browser returns; rejects on cancel, timeout or refusal. */
  signIn: (provider: Provider) => invoke<Profile>("account_sign_in", { provider }),
  cancelSignIn: () => invoke<void>("account_cancel_sign_in"),
  signOut: () => invoke<void>("account_sign_out"),
  pull: () => invoke<unknown>("account_pull"),
  push: (settings: unknown) => invoke<void>("account_push", { settings }),
};
