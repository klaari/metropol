const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  console.warn("EXPO_PUBLIC_API_URL is not set — download features disabled");
}

export async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<{ data: T | null; error: string | null }> {
  if (!API_URL) {
    return { data: null, error: "API URL not configured" };
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = body?.error || `HTTP ${res.status}`;
      return { data: null, error: msg };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
