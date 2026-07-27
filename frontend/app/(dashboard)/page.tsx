'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import api from '@/lib/api';
import { Meeting } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Video, 
  Plus, 
  Calendar, 
  ArrowRight,
  TrendingUp, 
  Clock, 
  CheckCircle,
  Copy,
  Play,
  VideoOff
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DashboardHome() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [joinOpen, setJoinOpen] = useState(false);
  const [meetingInput, setMeetingInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Dynamic timezone and clock formatting using Intl.DateTimeFormat
  const [localTimeStr, setLocalTimeStr] = useState('');
  const [timezoneStr, setTimezoneStr] = useState('');

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezoneStr(tz);

    const updateClock = () => {
      const now = new Date();
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
      const timeStr = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(now);
      setLocalTimeStr(`${weekday} • ${timeStr}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 30000); // Sync every 30s
    return () => clearInterval(timer);
  }, []);

  // Fetch meetings data from backend REST API using TanStack Query
  const { data: meetings = [], isLoading: isLoadingMeetings } = useQuery<Meeting[]>({
    queryKey: ['meetings'],
    queryFn: async () => {
      const res = await api.get('/meetings');
      return res.data;
    }
  });

  const { data: upcomingMeetings = [], isLoading: isLoadingUpcoming } = useQuery<Meeting[]>({
    queryKey: ['meetings', 'upcoming'],
    queryFn: async () => {
      const res = await api.get('/meetings/upcoming');
      return res.data;
    }
  });

  const { data: recentMeetings = [], isLoading: isLoadingRecent } = useQuery<Meeting[]>({
    queryKey: ['meetings', 'recent'],
    queryFn: async () => {
      const res = await api.get('/meetings/recent');
      return res.data;
    }
  });

  // Calculate dynamic metrics based on backend response
  const totalMeetings = meetings.length;
  const upcomingCount = upcomingMeetings.length;
  const recentCount = recentMeetings.length;

  // Mutation to create an Instant Meeting
  const createInstantMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/meetings/new', { host_name: user?.full_name || 'Host' });
      return res.data;
    },
    onSuccess: (data: Meeting) => {
      toast.success('Instant meeting created successfully!');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      router.push(`/meeting/${data.meeting_id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create meeting');
    }
  });

  // Helper to extract meeting ID from text or full invite link
  const extractMeetingId = (input: string): string => {
    const trimmed = input.trim();
    const linkMatch = trimmed.match(/\/join\/([a-z]{3}-\d{4}-[a-z]{3})/i);
    if (linkMatch && linkMatch[1]) {
      return linkMatch[1];
    }
    return trimmed;
  };

  // Handle joining a meeting via code/url
  const handleJoinMeeting = async () => {
    const targetId = extractMeetingId(meetingInput);
    if (!targetId) {
      toast.error('Please enter a valid meeting ID or invite link.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await api.get<Meeting>(`/meetings/${targetId}`);
      const meeting = res.data;

      if (meeting.status === 'completed') {
        toast.error('This meeting has already ended.');
      } else {
        setJoinOpen(false);
        setMeetingInput('');
        toast.success(`Joining meeting: ${meeting.title}`);
        router.push(`/meeting/${targetId}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Meeting code not found. Please verify.');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyInviteLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied to clipboard!');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Apple Workspace Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border pb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight leading-none">
            Good Morning, {user?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <div className="mt-2.5 space-y-0.5 select-none leading-none">
            <p className="text-foreground text-sm font-semibold">{localTimeStr}</p>
            <p className="text-muted-foreground text-[10px] font-bold tracking-wide">{timezoneStr}</p>
          </div>
          <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Today:</span>
            {isLoadingUpcoming ? (
              <Skeleton className="h-4 w-10 bg-muted" />
            ) : (
              <span className="text-foreground font-bold">{upcomingMeetings.length} Upcoming Meetings</span>
            )}
          </div>
        </div>

        {/* Hero actions inline shortcut buttons */}
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <Button 
            onClick={() => createInstantMeetingMutation.mutate()} 
            disabled={createInstantMeetingMutation.isPending}
            className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-9.5 px-4.5 rounded-lg shadow-sm cursor-pointer border border-transparent transition-all duration-150 active:scale-98"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Meeting
          </Button>
          
          {/* Join dialog modal button */}
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger className="bg-card border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground font-bold text-xs h-9.5 px-4.5 rounded-lg shadow-xs cursor-pointer transition-all duration-150 active:scale-98 inline-flex items-center justify-center">
              Join Meeting
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-xl shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground">Join Meeting Room</DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs mt-1 leading-relaxed">
                  Paste the unique code (abc-1234-xyz) or invite link below.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-muted-foreground text-xs font-semibold">Meeting ID or URL</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="e.g. abc-1234-xyz"
                    value={meetingInput}
                    onChange={(e) => setMeetingInput(e.target.value)}
                    className="bg-background border-border text-foreground text-xs focus-visible:ring-primary h-9 rounded-lg"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                <Button variant="ghost" onClick={() => setJoinOpen(false)} className="text-muted-foreground hover:bg-muted text-xs h-8.5 rounded-lg">
                  Cancel
                </Button>
                <Button 
                  onClick={handleJoinMeeting} 
                  disabled={isVerifying || !meetingInput.trim()}
                  className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-8.5 rounded-lg"
                >
                  {isVerifying ? 'Checking...' : 'Join Room'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={() => router.push('/schedule')}
            variant="outline"
            className="bg-card border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground font-bold text-xs h-9.5 px-4.5 rounded-lg shadow-xs cursor-pointer transition-all duration-150 active:scale-98"
          >
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* 2. Apple KPI Metrics Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <Card className="bg-card border-border text-foreground hover:-translate-y-0.5 hover:shadow-md transition-all duration-250 rounded-xl relative overflow-hidden shadow-xs border-0 border-b-[0.5px]">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4 space-y-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Meetings</span>
            <div className="p-1 rounded-lg text-primary bg-primary/10">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoadingMeetings ? (
              <Skeleton className="h-8 w-10 bg-muted" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground tracking-tight">{totalMeetings}</div>
            )}
            <p className="text-[9px] text-muted-foreground mt-1">Conferences hosted inside workspace</p>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card className="bg-card border-border text-foreground hover:-translate-y-0.5 hover:shadow-md transition-all duration-250 rounded-xl relative overflow-hidden shadow-xs border-0 border-b-[0.5px]">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4 space-y-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upcoming Scheduled</span>
            <div className="p-1 rounded-lg text-emerald-500 bg-emerald-500/10">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoadingMeetings ? (
              <Skeleton className="h-8 w-10 bg-muted" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground tracking-tight">{upcomingCount}</div>
            )}
            <p className="text-[9px] text-muted-foreground mt-1">Active scheduled calendar events</p>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card className="bg-card border-border text-foreground hover:-translate-y-0.5 hover:shadow-md transition-all duration-250 rounded-xl relative overflow-hidden shadow-xs border-0 border-b-[0.5px]">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-4 px-4 space-y-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recent Completed</span>
            <div className="p-1 rounded-lg text-indigo-500 bg-indigo-500/10">
              <CheckCircle className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoadingMeetings ? (
              <Skeleton className="h-8 w-10 bg-muted" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground tracking-tight">{recentCount}</div>
            )}
            <p className="text-[9px] text-muted-foreground mt-1">Completed and closed sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Apple Action Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Action Tile 1 */}
        <Card className="bg-card border-border rounded-xl p-6 flex flex-col justify-between h-44 hover:shadow-md hover:border-border/80 transition-all duration-250 group">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/10">
            <Video className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Instant Room</h3>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Start an instant video conference and copy invite links.</p>
          </div>
          <Button 
            onClick={() => createInstantMeetingMutation.mutate()} 
            disabled={createInstantMeetingMutation.isPending}
            className="w-full bg-primary hover:bg-primary/95 text-white font-bold text-[10px] h-8 rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
          >
            Host Instant Room
          </Button>
        </Card>

        {/* Action Tile 2 */}
        <Card className="bg-card border-border rounded-xl p-6 flex flex-col justify-between h-44 hover:shadow-md hover:border-border/80 transition-all duration-250 group">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/10">
            <Plus className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Join Conference</h3>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Connect to an ongoing session via unique meeting code.</p>
          </div>
          <Button 
            onClick={() => setJoinOpen(true)}
            variant="outline"
            className="w-full bg-card border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground font-bold text-[10px] h-8 rounded-lg shadow-xs transition-all duration-150 cursor-pointer"
          >
            Join with Code
          </Button>
        </Card>

        {/* Action Tile 3 */}
        <Card className="bg-card border-border rounded-xl p-6 flex flex-col justify-between h-44 hover:shadow-md hover:border-border/80 transition-all duration-250 group">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/10">
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Schedule Meeting</h3>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Coordinate duration and agenda for future meetings.</p>
          </div>
          <Button 
            onClick={() => router.push('/schedule')}
            variant="outline"
            className="w-full bg-card border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground font-bold text-[10px] h-8 rounded-lg shadow-xs transition-all duration-150 cursor-pointer"
          >
            Book Calendar Date
          </Button>
        </Card>
      </div>

      {/* 4. Meetings Section lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming scheduled events list */}
        <Card className="bg-card border-border text-foreground rounded-xl overflow-hidden shadow-xs border-0 border-b-[0.5px]">
          <CardHeader className="border-b border-border/80 py-3.5 px-5 flex flex-row items-center gap-2 shrink-0">
            <div className="bg-emerald-500/10 p-1 rounded-lg text-emerald-500">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upcoming Scheduled Meetings</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoadingUpcoming ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full bg-muted rounded-xl" />
                <Skeleton className="h-14 w-full bg-muted rounded-xl" />
              </div>
            ) : upcomingMeetings.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/60 border border-border">
                  <VideoOff className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">No upcoming meetings</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] leading-relaxed">Book a session in advance to view it here.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingMeetings.slice(0, 3).map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border/50 hover:border-border transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-foreground text-xs truncate leading-snug">{meeting.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 font-medium leading-none">
                        <span>{format(new Date(meeting.scheduled_at), 'MMM d, p')}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>{meeting.duration_minutes}m duration</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyInviteLink(meeting.invite_link)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 w-7 rounded-md border border-border/40 cursor-pointer"
                        title="Copy Invite Link"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/meeting/${meeting.meeting_id}`)}
                        className="bg-primary hover:bg-primary/95 text-white font-bold text-[10px] h-7 px-3 rounded-md shadow-xs flex items-center gap-1 cursor-pointer transition-all duration-150 active:scale-98"
                      >
                        <Play className="h-2.5 w-2.5 fill-current" /> Start
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent completed events list */}
        <Card className="bg-card border-border text-foreground rounded-xl overflow-hidden shadow-xs border-0 border-b-[0.5px]">
          <CardHeader className="border-b border-border/80 py-3.5 px-5 flex flex-row items-center gap-2 shrink-0">
            <div className="bg-indigo-500/10 p-1 rounded-lg text-indigo-500">
              <CheckCircle className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recent Completed Meetings</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoadingRecent ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full bg-muted rounded-xl" />
                <Skeleton className="h-14 w-full bg-muted rounded-xl" />
              </div>
            ) : recentMeetings.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground/60 border border-border">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">No historical records</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] leading-relaxed">Closed conferences will save here once completed.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMeetings.slice(0, 3).map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border/50"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-foreground text-xs truncate leading-snug">{meeting.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 font-medium leading-none">
                        <span>{format(new Date(meeting.scheduled_at), 'MMM d, p')}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>Host: {meeting.host_name}</span>
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground select-none">
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
