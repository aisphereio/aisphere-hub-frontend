import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_HUB_URL = 'http://aisphere-hub.aisphere.svc.cluster.local:18001';

/**
 * 同源 /v1 控制器面代理。
 *
 * 生产默认 Envoy Gateway 会把 /v1 路由到 hub，此时 NEXT_PUBLIC_HUB_URL 为空
 * （前端与 API 同源）。测试集群 Envoy gateway 未编程（PROGRAMMED=False），
 * 因此由 Next 在服务端把 /v1/* 转发到 hub 后端，避免浏览器侧 404。
 *
 * 保留 cookie + Authorization + x-aisphere-* 头：token 模式下前端会带
 * Authorization: Bearer <token>，gateway_oidc 模式下靠 cookie/x-aisphere-*。
 */
async function proxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  const query = request.nextUrl.search;
  const target = `${process.env.HUB_SERVICE_URL || DEFAULT_HUB_URL}/v1/${path.map(encodeURIComponent).join('/')}${query}`;
  const headers = new Headers();
  for (const name of [
    'content-type',
    'authorization',
    'cookie',
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
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;