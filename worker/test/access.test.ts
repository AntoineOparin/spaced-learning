import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { type AuthEnv, allowedEmail, authenticate } from '../access.ts';

const ISSUER = 'https://team.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const env: AuthEnv = {
  ACCESS_TEAM_DOMAIN: `${ISSUER}/`,
  ACCESS_AUD: AUD,
  ALLOWED_EMAIL: 'Me@Example.com',
};

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let getKey: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
  getKey = createLocalJWKSet({ keys: [jwk] });
});

async function token(
  claims: Record<string, unknown> = {},
  opts: { aud?: string; iss?: string; exp?: string } = {},
) {
  return new SignJWT({ email: 'me@example.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '1h')
    .sign(privateKey);
}

function request(jwt?: string, url = 'https://app.example.workers.dev/api/whoami') {
  return new Request(url, { headers: jwt ? { 'cf-access-jwt-assertion': jwt } : {} });
}

describe('authenticate', () => {
  it('accepts a valid token for the allowed email (case-insensitive)', async () => {
    expect(await authenticate(request(await token()), env, getKey)).toEqual({
      ok: true,
      email: 'me@example.com',
    });
  });

  it('rejects a missing token', async () => {
    expect(await authenticate(request(), env, getKey)).toMatchObject({ ok: false });
  });

  it.each([
    ['wrong audience', { aud: 'other-app' }],
    ['wrong issuer', { iss: 'https://evil.cloudflareaccess.com' }],
    ['expired', { exp: '-1m' }],
  ])('rejects a token with %s', async (_, opts) => {
    expect(await authenticate(request(await token({}, opts)), env, getKey)).toMatchObject({
      ok: false,
    });
  });

  it('rejects an email that is not allowed', async () => {
    const jwt = await token({ email: 'intruder@example.com' });
    expect(await authenticate(request(jwt), env, getKey)).toEqual({
      ok: false,
      reason: 'email not allowed',
    });
  });

  it('rejects a token signed by another key', async () => {
    const other = await generateKeyPair('RS256');
    const forged = await new SignJWT({ email: 'me@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUD)
      .setExpirationTime('1h')
      .sign(other.privateKey);
    expect(await authenticate(request(forged), env, getKey)).toMatchObject({ ok: false });
  });

  it('rejects a list of addresses even for one that is listed (single tenant)', async () => {
    const list = { ...env, ALLOWED_EMAIL: 'me@example.com, other@example.com' };
    expect(await authenticate(request(await token()), list, getKey)).toEqual({
      ok: false,
      reason: 'ALLOWED_EMAIL must be exactly one address',
    });
  });

  it('trims and lower-cases the configured address', async () => {
    const padded = { ...env, ALLOWED_EMAIL: '  Me@Example.COM ' };
    expect(await authenticate(request(await token()), padded, getKey)).toEqual({
      ok: true,
      email: 'me@example.com',
    });
  });

  it('fails closed when not configured', async () => {
    expect(await authenticate(request(await token()), {}, getKey)).toMatchObject({
      ok: false,
      reason: 'server auth is not configured',
    });
  });

  it('honours the dev bypass only on localhost', async () => {
    const dev: AuthEnv = { DEV_AUTH_BYPASS: '1', DEV_USER_EMAIL: 'dev@localhost' };
    expect(await authenticate(request(undefined, 'http://localhost:5173/api/whoami'), dev)).toEqual(
      {
        ok: true,
        email: 'dev@localhost',
      },
    );
    expect(
      await authenticate(request(undefined, 'https://app.example.workers.dev/api/whoami'), dev),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe('allowedEmail', () => {
  it.each([
    ['me@example.com', 'me@example.com'],
    [' Me@Example.com ', 'me@example.com'],
    ['', null],
    ['   ', null],
    ['a@b.c,d@e.f', null],
    ['a@b.c;d@e.f', null],
    ['a@b.c d@e.f', null],
    ['not-an-email', null],
    [undefined, null],
  ])('%j → %j', (value, expected) => {
    expect(allowedEmail({ ALLOWED_EMAIL: value })).toBe(expected);
  });
});
