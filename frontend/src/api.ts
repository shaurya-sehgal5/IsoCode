const API_URL = "http://localhost:5000/api";

export function getToken() {
  return localStorage.getItem("settleflow_token");
}

export function saveSession(token: string, user: unknown) {
  localStorage.setItem("settleflow_token", token);
  localStorage.setItem("settleflow_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("settleflow_token");
  localStorage.removeItem("settleflow_user");
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(
    path.startsWith("http") ? path : `${API_URL}${path}`,
    {
      ...options,
      headers,
    }
  );
}

export { API_URL };