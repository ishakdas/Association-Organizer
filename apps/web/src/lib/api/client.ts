const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  token?: string;
  associationId?: string;
}

export async function apiClient<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, associationId, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) ?? {}),
  };

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

  return response.json();
}
