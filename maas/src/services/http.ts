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

/** 前端请求 camelCase → 后端 snake_case（仅查询参数使用；请求体保持 camelCase 与后端 body.get("xxxYyy") 读取口径一致） */
export function requestToSnakeCase(data: unknown): unknown {
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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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

/**
 * 管理端点令牌（后端 /internal/* 已启用 AdminAuthFilter 强制认证）
 * 取 localStorage（真实登录 /internal/auth/login 签发的短时效令牌，见 MainLayout.setAdminToken）；
 * 构建期可注入 VITE_ADMIN_TOKEN 作为自动化/预览用途的引导令牌。
 * 不再有缺省演示令牌：未登录且未注入时请求将得到 401，由登录页接管。
 */
export const ADMIN_TOKEN_KEY = 'mas_admin_token';
const BUILD_ADMIN_TOKEN = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ADMIN_TOKEN;
export const DEFAULT_ADMIN_TOKEN = (BUILD_ADMIN_TOKEN && BUILD_ADMIN_TOKEN.trim()) || '';

export function getAdminToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || DEFAULT_ADMIN_TOKEN;
  } catch {
    return DEFAULT_ADMIN_TOKEN;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

/** 统一请求函数 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  const url = buildUrl(path, params);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // 管理端点附加认证令牌（AdminAuthFilter 校验，并据此回填 X-Operator 操作留痕）
  if (path.startsWith('/internal/')) {
    headers['X-Admin-Token'] = getAdminToken();
  }

  const fetchOptions: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    // 请求体保持 camelCase：后端管理端点统一按 body.get("grayPercent") 等 camel key 读取，
    // 此前转 snake 会导致后端静默取默认值（写操作看似 200 实际未生效）
    fetchOptions.body = JSON.stringify(body);
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
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: 'PATCH', body });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};
