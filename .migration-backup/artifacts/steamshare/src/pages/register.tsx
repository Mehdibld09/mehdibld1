import { useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, Zap, X } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  agreeTerms: z.boolean().refine((v) => v === true, {
    message: "You must agree to the terms to continue",
  }),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const registerUser = useRegister();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", email: "", password: "", agreeTerms: false },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");
    try {
      await registerUser.mutateAsync({ data: { username: values.username, email: values.email, password: values.password } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSuccess(true);
      setTimeout(() => setLocation("/"), 700);
    } catch (e: any) {
      setSubmitError(e.message || "Failed to create account. Username or email may already be taken.");
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
            <h2 className="text-3xl font-black text-foreground">Create account</h2>
            <p className="text-muted-foreground mt-2">Join the network and start trading today.</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <p className="font-bold text-lg text-foreground">Account created!</p>
                <p className="text-sm text-muted-foreground mt-1">Welcome to Steam Family 🎮</p>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          placeholder="Pick a username"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          className="h-12 bg-secondary/40 border-border focus:border-primary/60 rounded-xl"
                          {...field}
                          data-testid="input-email"
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
                      <FormLabel className="text-sm font-semibold text-foreground">Password</FormLabel>
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

                <FormField
                  control={form.control}
                  name="agreeTerms"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/20 border border-border">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-terms"
                            className="mt-0.5"
                          />
                        </FormControl>
                        <div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            I agree to the{" "}
                            <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
                            {" "}and{" "}
                            <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
                            I understand that sharing accounts may violate Steam's ToS and accept full responsibility.
                          </p>
                          <FormMessage className="mt-1" />
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 font-bold rounded-xl text-base"
                  disabled={registerUser.isPending}
                  data-testid="button-register-submit"
                >
                  {registerUser.isPending ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            </Form>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
