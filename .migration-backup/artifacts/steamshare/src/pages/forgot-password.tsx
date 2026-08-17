import { Layout } from "@/components/layout";
import { useForgotPassword } from "@workspace/api-client-react";
import { Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { KeyRound, CheckCheck, ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function ForgotPassword() {
  const forgotPassword = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");
    try {
      await forgotPassword.mutateAsync({ data: values });
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message || "Something went wrong. Please try again.");
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
            <KeyRound className="h-10 w-10 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-black">Forgot Password</h1>
            <p className="text-muted-foreground text-sm mt-2">Enter your email and we'll send you a reset link.</p>
          </div>

          <div className="p-8">
            {submitted ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="bg-green-500/20 rounded-full p-3">
                      <Mail className="h-7 w-7 text-green-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-400 mb-1">Check your inbox</p>
                    <p className="text-xs text-muted-foreground">
                      If an account with that email exists, a reset link has been sent.
                      If you don't receive it, contact a site admin for assistance.
                    </p>
                  </div>
                  <CheckCheck className="h-5 w-5 text-green-400 mx-auto" />
                </div>
                <Link href="/login">
                  <Button className="w-full" variant="outline">Back to Login</Button>
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {submitError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                      {submitError}
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full font-bold h-12" disabled={forgotPassword.isPending}>
                    {forgotPassword.isPending ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              </Form>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <Link href="/login" className="text-primary hover:underline">Back to Login</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
