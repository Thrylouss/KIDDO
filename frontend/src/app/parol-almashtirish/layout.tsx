import { AuthProvider } from "@/contexts/AuthContext";

export default function PasswordChangeLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
