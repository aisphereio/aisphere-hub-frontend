import { NextRequest } from 'next/server';

const DEFAULT_RUNTIME_URL = 'http://agentkit-runtime.agent-runtime.svc.cluster.local:8080';

async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const target = `${process.env.AGENT_RUNTIME_URL || DEFAULT_RUNTIME_URL}/api/${path.map(encodeURIComponent).join('/')}`;
  const headers = new Headers();
  for (const name of [
    'content-type',
    'cookie',
    'authorization',
    'x-aisphere-principal-jwt',
    'x-aisphere-user',
    'x-aisphere-org',
    'x-aisphere-project',
    'x-aisphere-auth-verified',
    'x-aisphere-subject',
    'x-aisphere-subject-type',
    'x-aisphere-org-id',
    'x-aisphere-project-id',
    'x-aisphere-username',
    'x-aisphere-name',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
  });
  return new Response(response.body, { status: response.status, headers: response.headers });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
