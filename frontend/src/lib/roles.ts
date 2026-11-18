import uz from "@/i18n";
import type { Role, User } from "@/types";

/** Foydalanuvchiga ko'rinadigan rol nomi (xom `user.role` qiymati ko'rsatilmasin). */
export const ROLE_LABELS: Record<Role, string> = {
  get super_admin() { return uz.foydalanuvchilar.rol_super_admin; },
  get admin() { return uz.foydalanuvchilar.rol_admin; },
  get teacher() { return uz.foydalanuvchilar.rol_teacher; },
  get parent() { return uz.foydalanuvchilar.rol_parent; },
};

export function roleLabel(role: Role | null | undefined): string {
  return role ? ROLE_LABELS[role] ?? "" : "";
}

/** Muvaffaqiyatli kirishdan keyin har bir rol o'z paneliga yo'naltiriladi. */
export const ROLE_ROUTES: Record<Role, string> = {
  super_admin: "/admin/dashboard",
  admin:       "/bogcha",
  teacher:     "/tarbiyachi",
  parent:      "/ota-ona",
};

/** Vaqtinchalik parol bilan kirgan foydalanuvchi avval shu sahifada parolni almashtiradi. */
export const PASSWORD_CHANGE_ROUTE = "/parol-almashtirish";

/** Tizimga kirgan foydalanuvchi qayerga yo'naltiriladi (login sahifasi va landing uchun bir xil qoida). */
export function landingFor(user: Pick<User, "role" | "must_change_password">): string {
  return user.must_change_password ? PASSWORD_CHANGE_ROUTE : ROLE_ROUTES[user.role] ?? "/login";
}
