import { useState, useEffect, useCallback } from "react";
import type { AuthSession, UserProfile } from "../../lib/types";

interface AuthState {
  session: AuthSession | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  const checkSession = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
      if (response?.ok && response.session) {
        const profileRes = await chrome.runtime.sendMessage({
          type: "GET_PROFILE",
          forceRefresh: false,
        });
        setState({
          session: response.session,
          profile: profileRes?.profile || null,
          loading: false,
          error: null,
        });
      } else {
        setState({ session: null, profile: null, loading: false, error: null });
      }
    } catch {
      setState({ session: null, profile: null, loading: false, error: null });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await chrome.runtime.sendMessage({
        type: "LOGIN",
        email,
        password,
      });
      if (response?.ok) {
        const profileRes = await chrome.runtime.sendMessage({
          type: "GET_PROFILE",
          forceRefresh: true,
        });
        setState({
          session: response.session,
          profile: profileRes?.profile || null,
          loading: false,
          error: null,
        });
        return true;
      } else {
        setState((s) => ({
          ...s,
          loading: false,
          error: response?.error || "Login failed",
        }));
        return false;
      }
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Login failed",
      }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "LOGOUT" });
    setState({ session: null, profile: null, loading: false, error: null });
  }, []);

  const refreshProfile = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({
      type: "GET_PROFILE",
      forceRefresh: true,
    });
    if (response?.profile) {
      setState((s) => ({ ...s, profile: response.profile }));
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return { ...state, login, logout, refreshProfile, checkSession };
}
