'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { User, Calendar, Mail, Key } from 'lucide-react';
import { format } from 'date-fns';

const profileSchema = zod.object({
  fullName: zod.string().min(1, 'Name cannot be empty').max(100, 'Name must be under 100 characters'),
  password: zod.string().min(6, 'Password must be at least 6 characters').or(zod.literal('')),
  confirmPassword: zod.string().or(zod.literal('')),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileInputs = zod.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, initAuth } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileInputs>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.full_name || '',
      password: '',
      confirmPassword: '',
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.put('/auth/profile', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      initAuth();
      reset({
        fullName: user?.full_name || '',
        password: '',
        confirmPassword: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    }
  });

  const onSubmit = (data: ProfileInputs) => {
    const payload: any = {
      full_name: data.fullName,
    };
    if (data.password) {
      payload.password = data.password;
    }
    updateProfileMutation.mutate(payload);
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Profile summary info Card */}
      <Card className="bg-card border-border text-foreground rounded-xl p-5 shadow-xs border-0 border-b-[0.5px]">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="h-14 w-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-border overflow-hidden shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-muted-foreground">{user?.full_name.charAt(0)}</span>
            )}
          </div>
          <div className="text-center sm:text-left space-y-1 flex-1 min-w-0">
            <h3 className="text-xs font-bold text-foreground truncate">{user?.full_name}</h3>
            <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-semibold">
              <span className="flex items-center justify-center sm:justify-start gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {user?.email}
              </span>
              <span className="flex items-center justify-center sm:justify-start gap-1.5 shrink-0">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Joined: {user?.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Profile Form Card */}
      <Card className="bg-card border-border text-foreground rounded-xl overflow-hidden shadow-xs border-0 border-b-[0.5px]">
        <CardHeader className="border-b border-border/85 pb-3 px-5 pt-4">
          <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Profile Configurations
          </CardTitle>
          <CardDescription className="text-muted-foreground text-[11px] mt-0.5 font-medium leading-relaxed">
            Modify your display name or update your secure account password credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-muted-foreground text-xs font-semibold">Display Name</Label>
              <Input
                id="fullName"
                {...register('fullName')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
              />
              {errors.fullName && (
                <p className="text-[10px] font-medium text-red-500">{errors.fullName.message}</p>
              )}
            </div>

            {/* Password edit section */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Key className="h-3.5 w-3.5 text-primary" />
                Change Password
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">Leave the password fields empty if you do not want to update it.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-muted-foreground text-xs font-semibold">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                    className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
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
                    className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
                  />
                  {errors.confirmPassword && (
                    <p className="text-[10px] font-medium text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions button */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-8.5 px-4 rounded-lg shadow-sm cursor-pointer transition-all duration-150 active:scale-98"
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
