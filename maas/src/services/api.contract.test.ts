/**
 * api.ts 底座对接函数 → 后端端点契约测试（联调闭环）。
 * 每一用例断言前端调用命中后端 FrontendApiContractTest 期望的精确路径与方法，
 * 确保「前端写操作真的打到真实端点」而非停留在 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../services/api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(body: unknown, status = 200) {
  const m = vi.fn().mockResolvedValue(json(body, status));
  vi.stubGlobal('fetch', m);
  return m;
}

describe('api.ts 底座对接端点契约（联调）', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('getIntegrations → GET /internal/integration', async () => {
    const m = mockFetch([]);
    await api.getIntegrations();
    const [url, opts] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration');
    expect(opts.method).toBe('GET');
  });

  it('saveIntegration → PUT /internal/integration', async () => {
    const m = mockFetch({});
    await api.saveIntegration({ code: 'IAM' } as any);
    const [url, opts] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration');
    expect(opts.method).toBe('PUT');
  });

  it('testIntegration(code) → POST /internal/integration/{code}/test', async () => {
    const m = mockFetch({});
    await api.testIntegration('IAM');
    const [url, opts] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration/IAM/test');
    expect(opts.method).toBe('POST');
  });

  it('syncIam → POST /internal/integration/iam/sync', async () => {
    const m = mockFetch({});
    await api.syncIam();
    const [url] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration/iam/sync');
    expect(m.mock.calls[0][1].method).toBe('POST');
  });

  it('pushMonitor → POST /internal/integration/monitor/push', async () => {
    const m = mockFetch({});
    await api.pushMonitor();
    const [url] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration/monitor/push');
    expect(m.mock.calls[0][1].method).toBe('POST');
  });

  it('forwardAlert(id) → POST /internal/integration/alert/forward/{id}', async () => {
    const m = mockFetch({});
    await api.forwardAlert('A1');
    const [url] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration/alert/forward/A1');
    expect(m.mock.calls[0][1].method).toBe('POST');
  });

  it('createIntegrationTicket → POST /internal/integration/ticket', async () => {
    const m = mockFetch({});
    await api.createIntegrationTicket({
      type: 'INCIDENT' as any,
      title: 't',
      content: 'c',
      from: 'f',
      deptName: 'd',
    });
    const [url] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration/ticket');
    expect(m.mock.calls[0][1].method).toBe('POST');
  });

  it('getIntegrationLogs → GET /internal/integration/logs', async () => {
    const m = mockFetch([]);
    await api.getIntegrationLogs();
    const [url] = m.mock.calls[0];
    expect(url).toContain('/smart-router/internal/integration/logs');
    expect(m.mock.calls[0][1].method).toBe('GET');
  });
});

describe('api.ts 防御兜底与请求体契约（深度优化回归）', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('getCircuitBreakers: 接口异常回落本地示例数据，不产生未捕获 rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const rows = await api.getCircuitBreakers();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('getQueueData: 接口异常回落本地示例数据，不产生未捕获 rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const rows = await api.getQueueData();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('getExecutedPolicies: 埋点接口异常回落推导展示，不产生未捕获 rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const items = await api.getExecutedPolicies('TRACE-404');
    expect(Array.isArray(items)).toBe(true);
  });

  it('saveOrchestration: 请求体统一 camelCase（与 http.ts 契约一致）', async () => {
    const m = mockFetch({});
    await api.saveOrchestration({
      mixDeploy: true, mixAffinity: ['a'], vramReserve: 15,
      weights: { P0: 8, P1: 5, P2: 2 },
      lowPrioritySlow: false, p0Preempt: true, continuousBatch: true, maxBatch: 64,
      kvCache: true, kvStrategy: 'ROUND_ROBIN', speculative: false, draftModel: 'd',
    } as any);
    const [, opts] = m.mock.calls[0];
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body);
    expect(body).toHaveProperty('mixedDeployEnabled', true);
    expect(body).toHaveProperty('batchMaxSize', 64);
    expect(body).toHaveProperty('prefixKvCache', true);
    expect(body).not.toHaveProperty('mixed_deploy_enabled');
  });

  it('saveKvGovernance: 请求体统一 camelCase（含 prefixKvCache）', async () => {
    const m = mockFetch({});
    await api.saveKvGovernance({ tenantIsolation: true, forbidSensitive: true, ttlMin: 60, auditEnabled: true } as any);
    const [, opts] = m.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body).toEqual({ kvTenantIsolate: true, kvSensitiveForbidden: true, kvTtlMin: 60, prefixKvCache: true });
    expect(body).not.toHaveProperty('prefix_kv_cache');
  });
});
