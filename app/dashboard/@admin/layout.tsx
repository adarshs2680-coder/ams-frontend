"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

// The unified analytics dashboard (/dashboard root) is open to admin, principal
// and HOD (department-scoped). Sub-routes (users, academics, config) stay
// admin-only until they get their own HOD/principal-scoped views.
const DASHBOARD_ROOT_ROLES: readonly string[] = ["admin", "principal", "hod"];
const SUB_ROUTE_ROLES: readonly string[] = ["admin"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading } = useAuth();

    const allowedRoles = pathname === "/dashboard" ? DASHBOARD_ROOT_ROLES : SUB_ROUTE_ROLES;
    const isAllowed = Boolean(user && allowedRoles.includes(user.role));

    useEffect(() => {
        if (isLoading) return;
        if (!isAllowed) {
            router.replace("/dashboard");
        }
    }, [isLoading, isAllowed, router]);

    // Show loader while auth resolves or while redirecting
    if (isLoading || !isAllowed) {
        return <div className="w-full h-full flex">
            <Loader2 className="animate-spin"/>
        </div>;
    }

    return <>{children}</>;
}
