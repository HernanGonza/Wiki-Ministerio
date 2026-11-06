import { API_URL } from '../lib';

// Cliente fetch mínimo. Todo es same-origin (nginx hace proxy de /api; si la app cuelga de /wiki/, de /wiki/api).
export class ApiError extends Error {
  status: number;
  code: string;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.message === 'string' ? body.message : `Error ${status}`);
    this.status = status;
    this.code = typeof body.error === 'string' ? body.error : 'error';
    this.body = body;
  }
}

type UnauthorizedHandler = (code: string) => void;
let onAuthFailure: UnauthorizedHandler = () => {};
export const setAuthFailureHandler = (fn: UnauthorizedHandler) => {
  onAuthFailure = fn;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  if (res.status === 204) return undefined as T;
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* respuesta sin JSON */
  }
  if (!res.ok) {
    const err = new ApiError(res.status, data);
    if (res.status === 401 && path !== '/auth/login') onAuthFailure('unauthenticated');
    if (res.status === 403 && err.code === 'must_change_password') onAuthFailure('must_change_password');
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};
