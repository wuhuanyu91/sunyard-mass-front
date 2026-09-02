/**
 * HTTP 客户端工具层
 *  - 封装 fetch，统一处理 base URL / 错误格式 / key 命名转换
 *  - 后端返回 snake_case，前端使用 camelCase，本层自动转换
 */

const BASE = '/smart-router';

/* ---------------- key 命名转换 ---------------- */

/** snake_case → camelCase */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** camelCase → snake_case */
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

/** 递归转换对象所有 key */
export function convertKeys<T = unknown>(obj: unknown, converter: (k: string) => string): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map((item) => convertKeys(item, converter)) as T;
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[converter(key)] = convertKeys(value, converter);
    }
    return result as T;
  }
  return obj as T;
}

/** 后端响应 snake_case → 前端 camelCase */
function responseToCamelCase<T>(data: unknown): T {
  return convertKeys<T>(data, snakeToCamel);
}

/** 前端请求 camelCase → 后端 snake_case */
function requestToSnakeCase(data: unknown): unknown {
  return convertKeys(data, camelToSnake);
}

/* ---------------- 错误处理 ---------------- */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ---------------- 核心请求函数 ---------------- */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

/** 构建带查询参数的 URL */
function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        // 前端 camelCase 参数名转为 snake_case 传给后端
        url.searchParams.set(camelToSnake(key), String(value));
      }
    }
  }
  return url.toString();
}

/** 统一请求函数 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  const url = buildUrl(path, params);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(requestToSnakeCase(body));
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    throw new ApiError(0, 'NETWORK_ERROR', `网络请求失败: ${url}`);
  }

  // 解析响应
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new ApiError(response.status, 'PARSE_ERROR', `响应解析失败: ${text.slice(0, 200)}`);
      }
    }
  }

  // 处理错误响应
  if (!response.ok) {
    const errorObj = data as { error?: { message?: string; type?: string; code?: string } } | null;
    const message = errorObj?.error?.message ?? `HTTP ${response.status}`;
    const code = errorObj?.error?.code ?? errorObj?.error?.type ?? 'UNKNOWN';
    throw new ApiError(response.status, code, message);
  }

  // 成功响应：转换 key 命名
  return responseToCamelCase<T>(data);
}

/* ---------------- 便捷方法 ---------------- */

export const http = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
    return request<T>(path, { params });
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'POST', body });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PUT', body });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};
