const BASE = import.meta.env.VITE_BFF_BASE_URL || '/api';

async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {
      /* keep raw */
    }
    throw new Error(message || res.statusText);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
  base: BASE,
};
