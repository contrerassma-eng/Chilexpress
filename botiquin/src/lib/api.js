// Cliente de la API del Worker. El PIN viaja en la cabecera X-Pin.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function call(path, { pin, method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'x-pin': pin || '',
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
  } catch {
    // Sin red: el llamador deja los movimientos en la cola y reintenta despues.
    throw new ApiError('Sin conexion', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `Error ${res.status}`, res.status);
  return data;
}

export const api = {
  ping: (pin) => call('/api/ping', { pin }),
  state: (pin) => call('/api/state', { pin }),
  movements: (pin, limit = 60) => call(`/api/movements?limit=${limit}`, { pin }),
  sync: (pin, movements, who) => call('/api/sync', { pin, method: 'POST', body: { movements, who } })
};
