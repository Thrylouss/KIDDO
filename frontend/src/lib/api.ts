import { IS_DEMO, handleDemoRequest } from "./demo-data";

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

// Endpoints whose 401 is an expected answer, handled by their callers:
// login (wrong credentials), logout (session already gone), me (not logged in).
const AUTH_ENDPOINTS = ["/v1/login", "/v1/logout", "/v1/me"];

let unauthorizedHandler: (() => void) | null = null;

/** Called when an authenticated request gets 401, i.e. the session has expired. */
export function setUnauthorizedHandler(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (IS_DEMO) return handleDemoRequest<T>(path, { method: options.method });

  const { body, headers, ...rest } = options;

  const orgId = getImpersonatedOrg();

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(orgId ? { "X-Impersonated-Org": orgId } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401 && !AUTH_ENDPOINTS.includes(path.split("?")[0])) {
      unauthorizedHandler?.();
    }
    const error = await res.json().catch(() => ({ message: "Server xatosi" }));
    // Vaqtinchalik parol almashtirilmagan — backend boshqa API'larni yopadi
    if (res.status === 403 && error?.code === "password_change_required"
        && typeof window !== "undefined" && window.location.pathname !== "/parol-almashtirish") {
      window.location.replace("/parol-almashtirish");
    }
    throw Object.assign(new Error(error.message ?? "So'rov bajarilmadi"), {
      status: res.status,
      data: error,
    });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Sahifalangan ro'yxatni to'liq yuklaydi (per_page=100, backend cheklovi bilan bir xil): masalan, Super Admin
 * tanlash ro'yxatlari uchun barcha bog'chalar. meta bo'lmasa (eski javob / demo rejim) — bitta sahifa.
 */
export async function fetchAllPages<T>(path: string, maxPages = 50): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await api.get<{ data?: T[]; meta?: { current_page: number; last_page: number } }>(`${path}${sep}per_page=100&page=${page}`);
    items.push(...(res?.data ?? []));
    if (!res?.meta || res.meta.current_page >= res.meta.last_page) break;
  }
  return items;
}

/**
 * Landing «14 kunlik bepul DEMO» arizasi — autentifikatsiyasiz. Demo (statik) rejimda ham haqiqiy backendga
 * yuboriladi: soxta «muvaffaqiyat» bilan ariza yo'qolib qolmasin. Xatoda api.request kabi { status, data } tashlaydi.
 */
export async function submitDemoRequest(body: Record<string, unknown>): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/v1/demo-requests`, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? "So'rov bajarilmadi"), { status: res.status, data });
  return data as { message: string };
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

/**
 * Fayl yuklash (multipart/form-data). Content-Type brauzer tomonidan qo'yiladi.
 * Xatoda api.request kabi { status, data } bilan xato tashlaydi.
 */
export async function uploadFile<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include", headers: { Accept: "application/json" }, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.();
    throw Object.assign(new Error(data.message ?? "Yuklab bo'lmadi"), { status: res.status, data });
  }
  return data as T;
}

/**
 * Faylni (Excel/PDF hisobot) cookie sessiyasi bilan yuklab olib, brauzerda saqlash oynasini ochadi.
 * Xatoda api.request kabi { status, data } bilan xato tashlaydi.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", headers: { Accept: "*/*" } });
  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.();
    const error = await res.json().catch(() => ({ message: "Server xatosi" }));
    throw Object.assign(new Error(error.message ?? "Yuklab bo'lmadi"), { status: res.status, data: error });
  }
  const name = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url  = URL.createObjectURL(await res.blob());
  const a    = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
