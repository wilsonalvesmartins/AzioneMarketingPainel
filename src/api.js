let csrfToken = '';

export function setCsrfToken(token) {
  csrfToken = token || '';
}

export async function api(path, options = {}) {
  const { raw = false, headers = {}, ...fetchOptions } = options;
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const requestHeaders = { ...headers };
  if (!raw && fetchOptions.body != null && !(fetchOptions.body instanceof FormData)) {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
    if (typeof fetchOptions.body !== 'string') fetchOptions.body = JSON.stringify(fetchOptions.body);
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfToken) {
    requestHeaders['X-CSRF-Token'] = csrfToken;
  }
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...fetchOptions,
    method,
    headers: requestHeaders
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(payload?.message || 'Não foi possível concluir a operação.');
    error.status = response.status;
    throw error;
  }
  return payload;
}
