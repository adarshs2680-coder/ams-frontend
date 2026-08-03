"use client";

import Navbar from "@/components/appshell/navbar";
import { useEffect, useMemo } from "react";
import { BellRing, BookOpen, Home, Users, ClipboardCheck, CalendarDays } from "lucide-react";
import Dock from '@/components/appshell/Dock';
import { Toaster } from '@/components/ui/sonner';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar as AvatarIcon, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { FLAGS } from "@/lib/flags";
import Loading from "@/app/loading";
import Avatar, { genConfig } from 'react-nice-avatar';

// Routes shared by all roles
const SHARED_ROUTES = [
  "/dashboard/profile",
  "/dashboard/notifications",
  "/dashboard/assignments",
  "/dashboard/calendar",
];

export default function DashboardLayout({
  children,
  admin,
  student,
  teacher,
  parent
}: Readonly<{
  children: React.ReactNode;
  admin: React.ReactNode;
  student: React.ReactNode;
  teacher: React.ReactNode;
  parent: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, session, incompleteProfile, config } = useAuth();
  const isSharedRoute = SHARED_ROUTES.some((r) => pathname.startsWith(r));
  const notificationsEnabled = Boolean(config[FLAGS.NOTIFICATIONS]);

  const profileImageConfig = useMemo(() => {
    const gender = user?.gender?.toLowerCase();
    const userGender: "man" | "woman" = gender === "male" || gender === "man" ? "man" : "woman";
    const randomConfig = genConfig(user?.email || "");
    return {
      ...randomConfig,
      sex: userGender,
    };
  }, [user?.email, user?.gender]);

  const dockItems = useMemo(() => {
    if (!user) return [];

    const baseItems: Array<{ icon: React.ReactNode; label: string; onClick: () => void }> = [
      { icon: <Home size={18} />, label: 'Home', onClick: () => router.push('/dashboard') },
    ];

    // Admin-specific items
    if (user.role === 'admin' || user.role === 'principal') {
      baseItems.push(
        { icon: <Users size={18} />, label: 'Users', onClick: () => router.push('/dashboard/users') },
        { icon: <BookOpen size={18} />, label: 'Academics', onClick: () => router.push('/dashboard/academics') },
      );
    }

    // Student-specific items
    if (user.role === 'student') {
      baseItems.push(
        { icon: <ClipboardCheck size={18} />, label: 'Attendance', onClick: () => router.push('/dashboard/attendance') }
      );
    }

    // Parent-specific items
    if (user.role === 'parent') {
      baseItems.push(
        { icon: <ClipboardCheck size={18} />, label: 'Attendance', onClick: () => router.push('/dashboard/attendance') }
      );
    }

    // Teacher-specific items
    if (user.role === 'teacher' || user.role === 'hod') {
      baseItems.push(
        { icon: <ClipboardCheck size={18} />, label: 'Attendance', onClick: () => router.push('/dashboard/attendance') }
      );
    }

    // Calendar — shared by all roles
    baseItems.push(
      { icon: <CalendarDays size={18} />, label: 'Calendar', onClick: () => router.push('/dashboard/calendar') },
    );

    // Common items for all roles
    if (notificationsEnabled) {
      baseItems.push(
        { icon: <BellRing size={18} />, label: 'Notifications', onClick: () => router.push('/dashboard/notifications') },
      );
    }

    // Profile item (always last)
    baseItems.push({
      icon: (
        user?.image != undefined && user?.image != "" && user?.image != "gen" ?
          <AvatarIcon className="h-6 w-6 sm:h-8 sm:w-8">
            <AvatarImage src={user?.image || ''} alt={user?.name || 'User'} />
            <AvatarFallback className="text-[8px]">{user?.name?.[0] || 'U'}</AvatarFallback>
          </AvatarIcon> :
          <Avatar {...profileImageConfig} className="h-6 w-6 sm:h-8 sm:w-8" />
      ),
      label: 'Profile',
      onClick: () => router.push('/dashboard/profile')
    });

    return baseItems;
  }, [notificationsEnabled, router, user, profileImageConfig]);

  useEffect(() => {
    if (isLoading) return;

    if (!session || !user) {
      router.push('/signin');
      return;
    }

    if (incompleteProfile) {
      router.push('/onboarding');
      return;
    }
  }, [isLoading, session, user, incompleteProfile, router]);

  useEffect(() => {
    if (isLoading) return;
    if (!notificationsEnabled && pathname.startsWith('/dashboard/notifications')) {
      router.replace('/dashboard');
    }
  }, [isLoading, notificationsEnabled, pathname, router]);

  if (isLoading) {
    return <Loading />;
  }

  if (!user || incompleteProfile) {
    return <Loading />;
  }

  return (
    <div className="flex h-screen w-full" suppressHydrationWarning>
      <Dock
        items={dockItems}
        panelHeight={68}
        baseItemSize={50}
        magnification={70}
        className="mb-6"
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <Toaster richColors
          position="top-center"
          toastOptions={{
            className: "!w-fit !max-w-sm mx-auto"
          }} />
        <div className="flex-1 overflow-auto sm:pb-20">
          {isSharedRoute && children}

          {!isSharedRoute && user.role === "student" && student}
          {!isSharedRoute && ["admin", "principal", "hod"].includes(user.role) && admin}
          {!isSharedRoute && user.role === "teacher" && teacher}
          {!isSharedRoute && user.role === "parent" && parent}

          {!isSharedRoute && !["student", "admin", "principal", "hod", "teacher", "parent"].includes(user.role) && (
            <div className="flex flex-1 items-center justify-center">
              <p>Your role &quot;{user.role}&quot; does not have a dashboard implemented yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}