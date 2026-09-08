export type AuthProvider = "Guest" | "Apple" | "WeChat";

export interface AuthSession {
  readonly userId: string;
  readonly provider: AuthProvider;
}

export interface AuthAdapter {
  signIn(): Promise<AuthSession>;
  signOut(): Promise<void>;
}
