import { useEffect } from 'react';
import { userapi, getToken } from '../services/userapi';

/**
 * Dev/demo-only auto-login. When `VITE_DEV_AUTO_LOGIN_EMAIL` and
 * `VITE_DEV_AUTO_LOGIN_PASSWORD` are BOTH set in `.env` and no session token
 * exists yet, this logs in once on app startup so the whole dashboard is
 * "signed in as admin" by default for demo and manual testing — without
 * anyone having to visit Settings and type credentials every session.
 *
 * Deliberately env-gated rather than hardcoded, for two reasons:
 *   1. The credentials live in `.env` (which `.env`'s own header already
 *      warns must never ship as-is), NOT baked into committed source. A
 *      production build simply omits these vars and this component is inert —
 *      `getToken()`-less users see the honest "Sign in" state instead.
 *   2. It calls the SAME real `userapi.login` (POST /auth/login, real JWT into
 *      sessionStorage) that the Settings login form uses — this is a genuine
 *      authenticated session, not a faked/bypassed one. `setToken` fires the
 *      `integrity-auth-changed` event, so the Sidebar profile updates to the
 *      real email with no extra wiring.
 *
 * Renders nothing.
 */
export const DevAutoLogin = () => {
  useEffect(() => {
    const email = import.meta.env.VITE_DEV_AUTO_LOGIN_EMAIL as string | undefined;
    const password = import.meta.env.VITE_DEV_AUTO_LOGIN_PASSWORD as string | undefined;
    if (!email || !password) return; // not configured -> inert (prod default)
    if (getToken()) return; // already have a real session -> never clobber it

    userapi.login(email, password).catch(() => {
      // A wrong/rotated dev password or an unreachable userapi shouldn't crash
      // the shell — the app just stays in the honest logged-out state, exactly
      // as if this component weren't here.
    });
  }, []);

  return null;
};
