export type Role = "admin" | "teacher" | "parent";

export interface User {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  kindergarten_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Kindergarten {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
