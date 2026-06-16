// Renders the credential-based login screen and submission flow.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import logoImage from "@/assets/logo.png";
import ndiImage from "@/assets/ndi_login.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearCurrentProfileQueryCache, queryClient } from "@/lib/query-client";
import { apiGet, apiPost } from "@/services/apiClient";
import { useUserStore } from "@/services/user-store";
import { showErrorToast, showSuccessToast } from "@/shared/lib/toast";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.input<typeof loginSchema>;

type LoginResponse = {
  message?: string;
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  token?: string;
  data?: {
    accessToken?: string;
    access_token?: string;
    refreshToken?: string;
    refresh_token?: string;
    token?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type ProfileResponse = {
  message?: string;
  data?: Record<string, unknown>;
  user?: Record<string, unknown>;
  [key: string]: unknown;
};

function pickProfileFromMeResponse(
  response: ProfileResponse,
): Record<string, unknown> | null {
  const raw =
    response.user ??
    response.data ??
    (response as unknown as Record<string, unknown>);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const inner = rec.user ?? rec.profile ?? rec.person;
  if (inner && typeof inner === "object" && !Array.isArray(inner))
    return inner as Record<string, unknown>;
  return rec;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const setAuthSession = useUserStore((state) => state.setAuthSession);
  const setUser = useUserStore((state) => state.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: (payload: LoginFormValues) =>
      apiPost<LoginResponse, { username: string; password: string }>(
        "/auth/login",
        {
          username: payload.username.trim(),
          password: payload.password,
        },
      ),
  });

  // Toggles password visibility for the password input.
  const handleShowPassword = () => {
    setShowPassword((previous) => !previous);
  };

  // Authenticates the user, stores session tokens, and routes to dashboard.
  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await loginMutation.mutateAsync(values);

      // Accept multiple token key shapes because auth payloads differ across environments.
      const accessToken =
        response.accessToken ??
        response.access_token ??
        response.data?.accessToken ??
        response.data?.access_token ??
        response.token;
      const refreshToken =
        response.refreshToken ??
        response.refresh_token ??
        response.data?.refreshToken ??
        response.data?.refresh_token;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token was returned.");
      }

      // apiClient attaches Bearer from localStorage (`fms-access-token`); that is written in setAuthSession.
      setAuthSession({
        accessToken,
        refreshToken,
        user: null,
      });

      let profile: Record<string, unknown> | null = null;
      setIsFetchingProfile(true);
      try {
        // Must not reuse another user's cached `/auth/me` (same key, no token in queryKey).
        clearCurrentProfileQueryCache();
        // Warm the current-profile cache right after login for role/permission-driven UI.
        const profileResponse = await apiGet<ProfileResponse>("/auth/me");
        queryClient.setQueryData(["current-profile"], profileResponse);
        profile = pickProfileFromMeResponse(profileResponse);
        if (profile) {
          setUser(profile);
        }
      } catch {
        profile = null;
      } finally {
        setIsFetchingProfile(false);
      }
      showSuccessToast(response.message ?? "Login successful");
      navigate("/dashboard");
    } catch (error) {
      showErrorToast(error, "Login failed. Please verify your credentials.");
    }
  };

  return (
    <main className="min-h-screen bg-[var(--fms-background)] px-4 py-10">
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <img
          src={logoImage}
          alt="FMS Logo"
          className="h-25 w-25 object-contain"
        />

        <Card className="w-full rounded-xl border border-[var(--fms-strokes)] bg-white py-10 shadow-sm">
          <CardContent className="space-y-5">
            <p className="text-center text-sm text-[var(--fms-text-subheading)]">
              Click to login as citizen to avail the service
            </p>

            <Button
              className="h-11 w-full cursor-pointer rounded-full bg-[var(--fms-ndi-button)]"
              onClick={() => navigate("/login/ndi")}
            >
              <img src={ndiImage} alt="" className="mr-2 h-5 w-5" />
              Login with Bhutan NDI
            </Button>

            <div className="flex items-center gap-4 text-sm text-[var(--fms-text-subheading)]">
              <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
              OR
              <div className="h-px flex-1 bg-[var(--fms-strokes)]" />
            </div>

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="your.email@fms.bt"
                  autoComplete="username"
                  {...register("username")}
                />
                {errors.username ? (
                  <p className="text-sm text-red-600">
                    {errors.username.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="password"
                    className="pr-10"
                    autoComplete="current-password"
                    {...register("password")}
                  />

                  <button
                    type="button"
                    onClick={handleShowPassword}
                    className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-[var(--fms-text-subheading)]"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 text-[var(--fms-text-subheading)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--fms-strokes)]"
                    {...register("rememberMe")}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="font-medium text-[var(--fms-accent-purple)]"
                >
                  Forgot password?
                </button>
              </div> */}

              {errors.password ? (
                <p className="text-sm text-red-600">
                  {errors.password.message}
                </p>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full rounded-md bg-[var(--fms-button)] hover:bg-[var(--fms-button-hover)]"
                disabled={loginMutation.isPending || isFetchingProfile}
              >
                {loginMutation.isPending || isFetchingProfile
                  ? "Signing In..."
                  : "Sign In"}
              </Button>

              <p className="text-center text-sm text-[var(--fms-text-subheading)]">
                Don&apos;t have an account?{" "}
                <Link
                  to="/signup"
                  className="font-medium text-[var(--fms-accent-purple)]"
                >
                  Register with NDI{" "}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
