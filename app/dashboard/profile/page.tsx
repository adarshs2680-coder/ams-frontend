"use client";

import ProfileForm from "@/components/profile/profile-form";
import ChangePasswordForm from "@/components/profile/change-password-form";
import Avatar, { genConfig } from "react-nice-avatar";
import {
  Avatar as AvatarIcon,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Briefcase,
  CalendarDays,
  GraduationCap,
  BadgeCheck,
} from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  const profileImageConfig: ReturnType<typeof genConfig> = useMemo(() => {
    const gender = user?.gender?.toLowerCase();
    const userGender: "man" | "woman" =
      gender === "male" || gender === "man" ? "man" : "woman";
    const randomConfig = genConfig(user?.email || "");
    return {
      ...randomConfig,
      sex: userGender,
    };
  }, [user]);

  if (isLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </main>
    );
  }

  const isStudent = user.role === "student";
  const isAdmin = user.role === "admin";
  const isTearcher = user.role === "teacher";



  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account information
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Card */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              {/* Avatar */}
              <div className="flex flex-col items-center text-center pb-5 border-b mb-5">
                {user.image && user.image !== "gen" ? (
                  <AvatarIcon className="h-20 w-20">
                    <AvatarImage
                      src={user.image}
                      alt={user.first_name || "User"}
                    />
                    <AvatarFallback>
                      {user.first_name?.[0] || "U"}
                    </AvatarFallback>
                  </AvatarIcon>
                ) : (
                  <Avatar {...profileImageConfig} className="h-20 w-20" />
                )}

                <div className="mt-3 text-lg font-semibold">
                  {user.first_name} {user.last_name}
                </div>

                <span className="mt-1 text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full capitalize">
                  {user.role}
                </span>
              </div>

              {/* Profile Completion */}
              {/* <div className="mb-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Profile completion</span>
                  <span>{completion}%</span>
                </div>

                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${completion}%` }}
                  />
                </div>

                {completion < 100 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Complete your profile
                  </p>
                )}
              </div> */}

              {/* Non-editable fields */}
              <div className="space-y-2 text-sm">
                {/* Department */}
                {/* <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                  <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      Department
                    </p>
                    <p className="font-medium">
                      {(user.profile as any)?.department ?? "—"}
                    </p>
                  </div>
                </div> */}

                {/* Teacher only fields */}
                {isAdmin && (
                  <>
                    {/* Department */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                      <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Department
                        </p>
                        <p className="font-medium">
                          {(user.profile as any)?.department ?? "—"}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Teacher only fields */}
                {isTearcher && (
                  <>
                    {/* Department */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                      <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Department
                        </p>
                        <p className="font-medium">
                          {(user.profile as any)?.department ?? "—"}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Student-only fields */}
                {isStudent && (
                  <>
                    
                    {/* Candidate Code */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                      <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center">
                        <BadgeCheck className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Candidate Code
                        </p>
                        <p className="font-medium">
                          {(user.profile as any)?.candidate_code ?? "—"}
                        </p>
                      </div>
                    </div>

                    {/* Admission Year */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                      <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center">
                        <CalendarDays className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Admission Year
                        </p>
                        <p className="font-medium">
                          {(user.profile as any)?.adm_year ?? "—"}
                        </p>
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                      <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Department
                        </p>
                        <p className="font-medium">
                          {(user.profile as any)?.department ?? "—"}
                        </p>
                      </div>
                    </div>

                    {/* DOB */}
                    {/* <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                      <GraduationCap className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Date of Birth
                        </p>
                        <p className="font-medium">
                          {(user.profile as any)?.date_of_birth ?? "—"}
                        </p>
                      </div>
                    </div> */}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Card */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              

              <ProfileForm initialUser={user} />
            </div>

            {/* Security */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm mt-6">
              <div className="flex items-center justify-between mb-5 pb-4 border-b">
                <h2 className="text-base font-semibold">Security</h2>
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Password
                </span>
              </div>

              <ChangePasswordForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}