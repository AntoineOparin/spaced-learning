/**
 * Worker entry. Static assets are served by Cloudflare directly; only /api/* and /auth/* reach
 * this code (see `run_worker_first` in wrangler.jsonc). Cloudflare Access sits in front of all of it.
 */
import { type AuthEnv, authenticate } from './access';
import { BadRequest, MAX_PULL_LIMIT, parsePushBody, pullRecords, pushRecords } from './sync';

type WorkerEnv = Env & AuthEnv;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS },
  });
}

async function handleApi(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth.ok) return json({ error: 'unauthorized', reason: auth.reason }, 401);

  const route = `${request.method} ${url.pathname}`;
  switch (route) {
    case 'GET /api/whoami':
      return json({ email: auth.email });

    case 'GET /api/sync/pull': {
      const since = Number(url.searchParams.get('since') ?? '0');
      const limit = Number(url.searchParams.get('limit') ?? String(MAX_PULL_LIMIT));
      if (!Number.isSafeInteger(since) || since < 0 || !Number.isFinite(limit)) {
        return json({ error: 'invalid since/limit' }, 400);
      }
      return json(await pullRecords(env.DB, since, limit));
    }

    case 'POST /api/sync/push': {
      if (!request.headers.get('content-type')?.includes('application/json')) {
        return json({ error: 'expected application/json' }, 415);
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid JSON' }, 400);
      }
      try {
        const records = parsePushBody(body);
        await pushRecords(env.DB, records);
        return json({ accepted: records.length });
      } catch (err) {
        if (err instanceof BadRequest) return json({ error: err.message }, 400);
        throw err;
      }
    }

    default:
      return json({ error: 'not found' }, 404);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    // Reached only after a successful Access login (Access intercepts it first); used by the
    // app's "Sign in to sync" link because the service worker serves "/" from its cache.
    if (url.pathname === '/auth/refresh') {
      return Response.redirect(new URL('/?signedIn=1', url).toString(), 302);
    }

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error('API error', err);
        return json({ error: 'internal error' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
