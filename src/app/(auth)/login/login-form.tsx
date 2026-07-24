"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";

export function LoginForm({
  appName,
  logo,
}: {
  appName: string;
  logo: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("login.failed"));
        return;
      }
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
      router.refresh();
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[420px]">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL logo from settings
            <img
              src={logo}
              alt={appName}
              className="h-12 max-w-[200px] object-contain"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-heading font-bold">
                {appName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <CardTitle className="text-heading text-primary">{appName}</CardTitle>
        <p className="mt-3 text-body text-text-muted">{t("login.subtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-body">
                {t("login.email")}
              </Label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <Input
                  id="email"
                  type="email"
                  placeholder={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-body">
                {t("login.password")}
              </Label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <Input
                  id="password"
                  type="password"
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {error && (
            <p
              className="text-body text-destructive rounded-md bg-destructive/10 px-3 py-2"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full flex items-center justify-center gap-2"
            disabled={loading}
          >
            <LogIn size={14} />
            {loading ? t("login.signingIn") : t("login.signIn")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
