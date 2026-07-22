// apps/web/src/api/client.ts

const API_URL = import.meta.env.VITE_API_URL || ''

console.log('[API] Base URL:', API_URL)

export const api = {
  // ============================================================
  // GET
  // ============================================================
  get: async <T>(endpoint: string, token?: string): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    console.log(`[API] GET ${API_URL}${endpoint}`)

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers,
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }))

      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  },


  // ============================================================
  // POST
  // ============================================================
  post: async <T>(
    endpoint: string,
    data?: any,
    token?: string
  ): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    console.log(`[API] POST ${API_URL}${endpoint}`, data)

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }))

      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  },


  // ============================================================
  // PUT
  // ============================================================
  put: async <T>(
    endpoint: string,
    data: any,
    token?: string
  ): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    console.log(`[API] PUT ${API_URL}${endpoint}`, data)

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }))

      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  },


  // ============================================================
  // PATCH
  // ============================================================
  patch: async <T>(
    endpoint: string,
    data: any,
    token?: string
  ): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    console.log(`[API] PATCH ${API_URL}${endpoint}`, data)

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }))

      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  },


  // ============================================================
  // DELETE
  // ============================================================
  del: async <T>(
    endpoint: string,
    token?: string
  ): Promise<T> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    console.log(`[API] DELETE ${API_URL}${endpoint}`)

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }))

      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  },


  // ============================================================
  // UPLOAD
  // ============================================================
  upload: async <T>(
    endpoint: string,
    formData: FormData,
    token?: string
  ): Promise<T> => {
    const headers: HeadersInit = {}

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    console.log(`[API] UPLOAD ${API_URL}${endpoint}`)

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }))

      throw new Error(error.error || `API Error: ${response.status}`)
    }

    return response.json()
  },
}
