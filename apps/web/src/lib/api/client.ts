const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  token?: string;
  associationId?: string;
}

export async function apiClient<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, associationId, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...((customHeaders as Record<string, string>) ?? {}),
    'ngrok-skip-browser-warning': 'true',
  };

  if (rest.body !== undefined && rest.body !== null) {
    headers['Content-Type'] ??= 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (associationId) {
    headers['x-association-id'] = associationId;
  }

  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail ?? `API error: ${response.status}`);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
