export async function apiClient<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  return response.json() as Promise<T>
}
