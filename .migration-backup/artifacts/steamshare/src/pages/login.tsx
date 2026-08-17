import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, Zap, X } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");
    try {
      await login.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSuccess(true);
      setTimeout(() => setLocation("/"), 600);
    } catch (e: any) {
      setSubmitError(e.message || "Invalid username or password. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — game collage */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src="/games-collage-new.png"
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background relative">
        <button
          onClick={() => setLocation("/")}
          className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <span className="font-black text-xl text-foreground">Steam Family</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-foreground">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in to your account to continue.</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <p className="font-bold text-lg text-foreground">You're in!</p>
                <p className="text-sm text-muted-foreground mt-1">Redirecting to the marketplace…</p>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {submitError && (
                  <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                    <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your username"
                          className="h-12 bg-secondary/40 border-border focus:border-primary/60 rounded-xl"
                          {...field}
                          data-testid="input-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-sm font-semibold text-foreground">Password</FormLabel>
                        <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-12 bg-secondary/40 border-border focus:border-primary/60 rounded-xl pr-12"
                            {...field}
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 font-bold rounded-xl text-base mt-2"
                  disabled={login.isPending}
                  data-testid="button-login-submit"
                >
                  {login.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </Form>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
