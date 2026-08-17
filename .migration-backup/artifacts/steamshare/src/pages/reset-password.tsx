import { Layout } from "@/components/layout";
import { useResetPassword } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  token: z.string().min(10, "Please enter a valid reset token"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const resetPassword = useResetPassword();
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { token: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");
    try {
      await resetPassword.mutateAsync({ data: { token: values.token, newPassword: values.newPassword } });
      setSuccess(true);
    } catch (e: any) {
      setSubmitError(e.message || "Invalid or expired token. Please try again.");
    }
  }

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mb-4">
          <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="bg-muted/30 p-8 text-center border-b border-border">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-black">Reset Password</h1>
            <p className="text-muted-foreground text-sm mt-2">Enter your reset token and choose a new password.</p>
          </div>

          <div className="p-8">
            {success ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <h2 className="text-xl font-bold">Password Reset!</h2>
                <p className="text-muted-foreground text-sm">Your password has been changed successfully. You can now log in with your new password.</p>
                <Button className="w-full" onClick={() => setLocation("/login")}>Go to Login</Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {submitError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                      {submitError}
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reset Token</FormLabel>
                        <FormControl>
                          <Input placeholder="Paste your token here..." className="font-mono text-sm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full font-bold h-12" disabled={resetPassword.isPending}>
                    {resetPassword.isPending ? "Resetting..." : "Reset Password"}
                  </Button>
                </form>
              </Form>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <Link href="/forgot-password" className="text-primary hover:underline">Back to Forgot Password</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
