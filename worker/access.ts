/**
 * Defence in depth behind Cloudflare Access: every API request must carry a valid Access JWT
 * (`Cf-Access-Jwt-Assertion`) for this application's audience, from our team domain, for an
 * allowed email. This keeps the API closed even if the Access policy is misconfigured.
 */
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';

export interface AuthEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** One address, or several separated by commas. */
  ALLOWED_EMAIL?: string;
  /** Local development only; ignored unless the request is to localhost. */
  DEV_AUTH_BYPASS?: string;
  DEV_USER_EMAIL?: string;
}

export type AuthResult = { ok: true; email: string } | { ok: false; reason: string };

const jwksByIssuer = new Map<string, JWTVerifyGetKey>();

function isLocalhost(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
}

export async function authenticate(
  request: Request,
  env: AuthEnv,
  getKey?: JWTVerifyGetKey,
): Promise<AuthResult> {
  const url = new URL(request.url);
  if (env.DEV_AUTH_BYPASS === '1' && isLocalhost(url)) {
    return { ok: true, email: env.DEV_USER_EMAIL ?? 'dev@localhost' };
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, reason: 'missing Access token' };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ALLOWED_EMAIL) {
    return { ok: false, reason: 'server auth is not configured' };
  }

  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/+$/, '');
  let keys = getKey ?? jwksByIssuer.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByIssuer.set(issuer, keys);
  }

  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ['RS256'],
    });
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    const allowed = env.ALLOWED_EMAIL.split(',').map((e) => e.trim().toLowerCase());
    if (!email || !allowed.includes(email)) return { ok: false, reason: 'email not allowed' };
    return { ok: true, email };
  } catch {
    return { ok: false, reason: 'invalid Access token' };
  }
}
