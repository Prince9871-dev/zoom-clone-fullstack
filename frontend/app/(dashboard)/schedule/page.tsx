'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';

const scheduleSchema = zod.object({
  title: zod.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: zod.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
  date: zod.string().min(1, 'Date is required'),
  time: zod.string().min(1, 'Time is required'),
  duration: zod.string().min(1, 'Duration is required'),
});

type ScheduleInputs = zod.infer<typeof scheduleSchema>;

export default function SchedulePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleInputs>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      duration: '40',
      description: '',
    }
  });

  const scheduleMeetingMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/meetings/schedule', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Meeting scheduled successfully!');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      router.push('/meetings');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to schedule meeting');
    }
  });

  const onSubmit = (data: ScheduleInputs) => {
    const durationMinutes = parseInt(data.duration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      toast.error('Duration must be a positive number of minutes (max 24 hours).');
      return;
    }

    const scheduledDateTime = `${data.date}T${data.time}:00`;
    const scheduledEpoch = new Date(scheduledDateTime).getTime();
    if (scheduledEpoch <= Date.now()) {
      toast.error('The scheduled start time must be in the future.');
      return;
    }

    const payload = {
      title: data.title,
      description: data.description || null,
      scheduled_at: scheduledDateTime,
      duration_minutes: durationMinutes,
      host_name: user?.full_name || 'Host',
    };

    scheduleMeetingMutation.mutate(payload);
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card className="bg-card border-border text-foreground rounded-xl overflow-hidden shadow-xs border-0 border-b-[0.5px]">
        <CardHeader className="pb-4 px-6 pt-5">
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarDays className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-bold text-foreground">Schedule a Meeting</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed font-medium">
            Configure a future conference room. Calendar join links will compile automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-muted-foreground text-xs font-semibold">Topic / Title</Label>
              <Input
                id="title"
                placeholder="e.g. Q3 Roadmap review"
                {...register('title')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
              />
              {errors.title && (
                <p className="text-[10px] font-medium text-red-500">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-muted-foreground text-xs font-semibold">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Brief agenda or agenda summary"
                {...register('description')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
              />
              {errors.description && (
                <p className="text-[10px] font-medium text-red-500">{errors.description.message}</p>
              )}
            </div>

            {/* Date & Time Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-muted-foreground text-xs font-semibold">Start Date</Label>
                <Input
                  id="date"
                  type="date"
                  min={new Date().toISOString().split('T')[0]} 
                  {...register('date')}
                  className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
                />
                {errors.date && (
                  <p className="text-[10px] font-medium text-red-500">{errors.date.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="time" className="text-muted-foreground text-xs font-semibold">Start Time</Label>
                <Input
                  id="time"
                  type="time"
                  {...register('time')}
                  className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
                />
                {errors.time && (
                  <p className="text-[10px] font-medium text-red-500">{errors.time.message}</p>
                )}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="duration" className="text-muted-foreground text-xs font-semibold">Duration (Minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="40"
                {...register('duration')}
                className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg shadow-xs"
              />
              {errors.duration && (
                <p className="text-[10px] font-medium text-red-500">{errors.duration.message}</p>
              )}
            </div>

            {/* Actions buttons */}
            <div className="flex gap-2.5 justify-end pt-4 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/meetings')}
                className="text-muted-foreground hover:bg-muted text-xs h-8.5 rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={scheduleMeetingMutation.isPending}
                className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-8.5 px-4 rounded-lg shadow-sm cursor-pointer transition-all duration-150 active:scale-98"
              >
                {scheduleMeetingMutation.isPending ? 'Scheduling...' : 'Schedule'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
