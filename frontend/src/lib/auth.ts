// Authentication token is managed as an httpOnly cookie set by the backend.
// These stubs exist so imports compile; they perform no storage operations.
export function getToken(): string | null { return null; }
export function setToken(_: string): void {}
export function clearToken(): void {}
