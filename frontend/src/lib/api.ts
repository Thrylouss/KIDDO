import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function getImpersonatedOrg(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("impersonated_org_id");
}

export const impersonation = {
  start(orgId: number, orgName: string) {
    sessionStorage.setItem("impersonated_org_id", String(orgId));
    sessionStorage.setItem("impersonated_org_name", orgName);
  },
  end() {
    sessionStorage.removeItem("impersonated_org_id");
    sessionStorage.removeItem("impersonated_org_name");
  },
  active(): boolean {
    return typeof window !== "undefined" && !!sessionStorage.getItem("impersonated_org_id");
  },
  orgName(): string {
    return (typeof window !== "undefined" && sessionStorage.getItem("impersonated_org_name")) || "";
  },
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const token = getToken();
  const orgId = getImpersonatedOrg();

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(orgId ? { "X-Impersonated-Org": orgId } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Server xatosi" }));
    throw Object.assign(new Error(error.message ?? "So'rov bajarilmadi"), {
      status: res.status,
      data: error,
    });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "GET", ...opts }),

  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "POST", body, ...opts }),

  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PUT", body, ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: "PATCH", body, ...opts }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...opts }),
};
