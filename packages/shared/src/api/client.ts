type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ApiClientOptions {
  baseUrl: string
  getToken?: () => Promise<string | null>
}

export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  return async function api<T>(
    path: string,
    options: { method?: HttpMethod; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const { method = 'GET', body, headers = {} } = options
    const token = getToken ? await getToken() : null

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error((err as { error?: string }).error || `API error ${res.status}`)
    }

    return res.json() as Promise<T>
  }
}
