/**
 * authApi — adapter over the orval-generated AuthnService client.
 *
 * Preserves the hand-written module's public signatures (exchange,
 * loginUrl, login, refresh, logoutUrl, logout, me) so consumers
 * (use-auth.ts, auth/callback) keep importing from ../index unchanged.
 *
 * Notable normalizations vs. the generated client:
 *  - exchange/refresh: generated V1ExchangeResponse uses camelCase fields
 *    with expiresIn as a string; the UI expects a numeric expiresIn. We
 *    also keep returning snake_case fallbacks (access_token) because older
 *    call sites may read them.
 *  - me(): generated returns V1MeResponse { principal }; useMe() reads
 *    raw.principal, so we return the envelope directly.
 *  - login()/logout(): browser 302 entry points, not API calls — unchanged.
 */
import {
  authnServiceExchange,
  authnServiceLoginURL,
  authnServiceLogoutURL,
  authnServiceMe,
  authnServiceRefresh,
} from '../generated/authn-service/authn-service';
import type { V1MeResponse } from '../generated/model';
import { buildGatewayLoginUrl, GATEWAY_LOGOUT_PATH } from '../client';

export const authApi = {
  exchange: async (code: string, redirectUri: string, state = '') => {
    const raw = await authnServiceExchange({
      code,
      redirectUri,
      state,
    });
    return {
      accessToken: raw.accessToken || '',
      refreshToken: raw.refreshToken || '',
      idToken: raw.idToken || '',
      tokenType: raw.tokenType || '',
      expiresIn: Number(raw.expiresIn) || 0,
      scope: raw.scope || '',
      // snake_case aliases for legacy call sites
      access_token: raw.accessToken || '',
      refresh_token: raw.refreshToken || '',
      id_token: raw.idToken || '',
      token_type: raw.tokenType || '',
      expires_in: Number(raw.expiresIn) || 0,
    };
  },

  loginUrl: (redirectUri: string, state = '') =>
    authnServiceLoginURL({ redirectUri, state }).then(
      (r) => r.loginUrl || '',
    ),

  /** Browser entry point: returns the full hub URL for 302 redirect to Casdoor. */
  login: (_redirectUri: string, _state = '') => buildGatewayLoginUrl(),

  /** Refresh the access token using a refresh token. */
  refresh: async (refreshToken: string) => {
    const raw = await authnServiceRefresh({ refreshToken });
    return {
      accessToken: raw.accessToken || '',
      refreshToken: raw.refreshToken || '',
      idToken: raw.idToken || '',
      expiresIn: Number(raw.expiresIn) || 0,
      access_token: raw.accessToken || '',
      refresh_token: raw.refreshToken || '',
      id_token: raw.idToken || '',
      expires_in: Number(raw.expiresIn) || 0,
    };
  },

  /** Returns the Casdoor logout URL (JSON). Browser users can also call GET /v1/authn/logout directly. */
  logoutUrl: (
    postLogoutRedirectUri = '',
    idTokenHint = '',
    state = '',
  ) =>
    authnServiceLogoutURL({
      postLogoutRedirectUri: postLogoutRedirectUri || undefined,
      idTokenHint: idTokenHint || undefined,
      state: state || undefined,
    }).then((r) => r.logoutUrl || ''),

  /** Browser entry point: full hub URL for 302 redirect to Casdoor end-session. */
  logout: (
    _postLogoutRedirectUri = '',
    _idTokenHint = '',
    _state = '',
  ) => GATEWAY_LOGOUT_PATH,

  /** Returns the current authenticated principal envelope ({ principal }). */
  me: (): Promise<V1MeResponse> => authnServiceMe(),
};
