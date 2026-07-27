'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';

const registerSchema = zod.object({
  fullName: zod.string().min(1, 'Full name is required').max(100, 'Name must be under 100 characters'),
  email: zod.string().min(1, 'Email is required').email('Invalid email address'),
  password: zod.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: zod.string().min(1, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterInputs = zod.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: signUp, isLoading, error, clearError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInputs>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInputs) => {
    clearError();
    const success = await signUp(data.email, data.fullName, data.password);
    if (success) {
      toast.success('Account created successfully! Please sign in.');
      router.push('/login');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 transition-colors duration-200">
      <Card className="w-full max-w-md bg-card border-border text-card-foreground shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="space-y-1.5 pb-4">
          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <div className="bg-primary p-2 rounded-xl text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-video"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            </div>
            <span className="font-extrabold text-xl tracking-tight text-foreground">Zoom Clone</span>
          </div>
          <CardTitle className="text-xl text-center font-bold text-foreground">Create an account</CardTitle>
          <CardDescription className="text-center text-muted-foreground text-xs">
            Sign up below to access your video conferencing suite
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-muted-foreground text-xs font-semibold">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Diana Prince"
                {...register('fullName')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg"
                aria-invalid={!!errors.fullName}
              />
              {errors.fullName && (
                <p className="text-[10px] font-medium text-red-500">{errors.fullName.message}</p>
              )}
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-muted-foreground text-xs font-semibold">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-[10px] font-medium text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-muted-foreground text-xs font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg"
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-[10px] font-medium text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-muted-foreground text-xs font-semibold">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg"
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && (
                <p className="text-[10px] font-medium text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/95 text-white font-bold text-xs h-9 rounded-lg shadow-sm mt-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating account...</span>
                </div>
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 border-t border-border pt-4 px-6 pb-5 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-bold">
              Sign In
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
