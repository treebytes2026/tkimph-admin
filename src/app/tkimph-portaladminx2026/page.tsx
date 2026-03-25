import { AdminLoginForm } from "@/components/auth/admin-login-form";

export default function PortalAdminLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/35 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(233,87,63,0.18),transparent_52%)]" />
      <div className="relative z-10 w-full">
        <AdminLoginForm />
      </div>
    </div>
  );
}
