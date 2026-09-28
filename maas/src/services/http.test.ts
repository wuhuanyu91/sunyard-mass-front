/**
 * http.ts 单测：覆盖 (1) key 命名转换纯函数；(2) request() 的请求契约——
 * URL 前缀 /internal 自动加 X-Admin-Token、请求体保持 camelCase、查询参数 camel→snake、
 * 错误响应映射为 ApiError。这是「前端调用侧」契约，与后端 FrontendApiContractTest 闭环。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertKeys, requestToSnakeCase, http, DEFAULT_ADMIN_TOKEN } from '../services/http';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('key 命名转换', () => {
  it('requestToSnakeCase: camelCase 查询参数转 snake_case', () => {
    expect(requestToSnakeCase({ grayPercent: 10, modelId: 'm1' })).toEqual({
      gray_percent: 10,
      model_id: 'm1',
    });
  });

  it('convertKeys 递归处理嵌套对象与数组', () => {
    const out = convertKeys(
      { outerKey: { innerKey: 1 }, listKey: [{ leafKey: 2 }] },
      (k) => k.toUpperCase(),
    );
    expect(out).toEqual({ OUTERKEY: { INNERKEY: 1 }, LISTKEY: [{ LEAFKEY: 2 }] });
  });

  it('convertKeys 对 null/undefined 原样返回', () => {
    expect(convertKeys(null, (k) => k)).toBeNull();
    expect(convertKeys(undefined, (k) => k)).toBeUndefined();
  });

  it('响应 snake_case 自动转回 camelCase（model_id -> modelId）', () => {
    const out = convertKeys(
      { model_id: 'm', task_success_rate: 0.9, nested: { avg_latency_ms: 5 } },
      (k) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()),
    );
    expect(out).toEqual({ modelId: 'm', taskSuccessRate: 0.9, nested: { avgLatencyMs: 5 } });
  });
});

describe('request() 调用契约', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('GET /internal/* 自动拼 /smart-router 前缀并附带 X-Admin-Token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await http.get<{ ok: number }>('/internal/integration');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration');
    expect(opts.method).toBe('GET');
    expect(opts.headers['X-Admin-Token']).toBe(DEFAULT_ADMIN_TOKEN);
    expect(res).toEqual({ ok: 1 });
  });

  it('POST 请求体保持 camelCase（不转 snake，与后端 body.get("xxxYyy") 读取口径一致）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: '1' }));
    vi.stubGlobal('fetch', fetchMock);

    await http.post('/internal/integration', { code: 'IAM', enabled: true, lastSyncAt: null });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ code: 'IAM', enabled: true, lastSyncAt: null }));
  });

  it('GET 查询参数 camelCase 自动转 snake_case', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await http.get('/internal/dashboard/token-series', { hours: 24, step: 60 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('hours=24');
    expect(url).toContain('step=60');
  });

  it('401 响应映射为 ApiError（code=unauthorized），供前端统一拦截', async () => {
    const body = JSON.stringify({ error: { code: 'unauthorized', message: '需要令牌' } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 401, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(http.get('/internal/integration')).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
  });

  it('网络异常（fetch 抛错）映射为 NETWORK_ERROR', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(http.get('/internal/integration')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
