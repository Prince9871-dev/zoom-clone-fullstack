'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Meeting } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  CalendarDays, 
  Clock, 
  Play, 
  Copy, 
  User as UserIcon,
  VideoOff,
  Plus,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function MeetingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch upcoming and recent meetings from backend
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

  // Mutation to cancel/delete a scheduled meeting
  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      await api.delete(`/meetings/${meetingId}`);
    },
    onSuccess: () => {
      toast.success(`Meeting deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to cancel meeting');
    }
  });

  // Search filter helper
  const filterMeetings = (list: Meeting[]) => {
    return list.filter(meeting => 
      meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.host_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meeting.description && meeting.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const filteredUpcoming = filterMeetings(upcomingMeetings);
  const filteredRecent = filterMeetings(recentMeetings);

  const copyInviteLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied to clipboard!');
  };

  const handleDeleteClick = (meetingId: string) => {
    if (window.confirm('Are you sure you want to cancel and delete this meeting?')) {
      deleteMeetingMutation.mutate(meetingId);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Search Header panel */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between border-b border-border pb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search meetings by title or host..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card border-border text-foreground pl-9 focus-visible:ring-primary h-9 text-xs rounded-lg shadow-xs"
          />
        </div>
        
        <Button
          onClick={() => router.push('/schedule')}
          className="bg-primary hover:bg-primary/95 text-white text-xs h-9 font-bold rounded-lg flex items-center gap-1.5 shadow-sm px-4 shrink-0 transition-all duration-150 active:scale-98 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Schedule Meeting
        </Button>
      </div>

      {/* Tabs list container */}
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="bg-zinc-200/50 dark:bg-zinc-800/40 p-0.5 rounded-lg border border-border inline-flex mb-6">
          <TabsTrigger 
            value="upcoming" 
            className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground text-xs px-4 py-1.5 rounded-md font-bold transition-all cursor-pointer"
          >
            Upcoming Scheduled
          </TabsTrigger>
          <TabsTrigger 
            value="previous" 
            className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground text-xs px-4 py-1.5 rounded-md font-bold transition-all cursor-pointer"
          >
            Past / Completed
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Upcoming Scheduled */}
        <TabsContent value="upcoming" className="focus-visible:outline-none">
          {isLoadingUpcoming ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Skeleton className="h-40 w-full bg-muted rounded-xl" />
              <Skeleton className="h-40 w-full bg-muted rounded-xl" />
            </div>
          ) : filteredUpcoming.length === 0 ? (
            <Card className="bg-card border-border text-foreground rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3.5 shadow-xs border-0 border-b-[0.5px]">
              <div className="bg-muted flex items-center justify-center p-3 rounded-full text-muted-foreground border border-border">
                <VideoOff className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground">No upcoming meetings</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed font-medium">
                  There are no future meetings scheduled. Let's create one now!
                </p>
              </div>
              <Button 
                onClick={() => router.push('/schedule')}
                size="sm"
                className="bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-lg mt-1 transition-all duration-150 cursor-pointer"
              >
                Schedule Session
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredUpcoming.map((meeting) => (
                <Card 
                  key={meeting.id} 
                  className="bg-card border-border hover:shadow-md transition-all duration-200 rounded-xl flex flex-col justify-between overflow-hidden shadow-xs border-0 border-b-[0.5px]"
                >
                  <CardHeader className="pb-3 pt-4.5 px-4.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex items-center text-[9px] font-bold tracking-wider text-primary uppercase bg-primary/10 border border-primary/10 px-2 py-0.5 rounded-full mb-2">
                          Scheduled
                        </span>
                        <CardTitle className="text-xs font-bold text-foreground truncate">{meeting.title}</CardTitle>
                      </div>
                      <span className="text-[9px] bg-background px-2 py-0.5 rounded-md border border-border text-muted-foreground font-mono shrink-0 select-none">
                        {meeting.meeting_id}
                      </span>
                    </div>
                    {meeting.description && (
                      <p className="text-muted-foreground text-[10px] line-clamp-2 mt-1.5 leading-relaxed font-medium">
                        {meeting.description}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-1.5 pb-4 px-4.5 text-muted-foreground text-[11px] font-semibold leading-none">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{format(new Date(meeting.scheduled_at), 'PPP')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {format(new Date(meeting.scheduled_at), 'p')} ({meeting.duration_minutes} minutes)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Host: {meeting.host_name}</span>
                    </div>
                  </CardContent>

                  <div className="border-t border-border/85 p-3.5 bg-background/35 flex gap-2 justify-end shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyInviteLink(meeting.invite_link)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 h-8 w-8 rounded-lg cursor-pointer"
                      title="Copy Invite Link"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(meeting.meeting_id)}
                      disabled={deleteMeetingMutation.isPending}
                      className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 text-xs h-8 px-3 rounded-lg font-bold cursor-pointer"
                    >
                      Cancel
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => router.push(`/meeting/${meeting.meeting_id}`)}
                      className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-8 px-4 rounded-lg shadow-sm transition-all duration-150 cursor-pointer active:scale-98"
                    >
                      <Play className="h-2.5 w-2.5 fill-current mr-1" /> Start
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Past / Completed */}
        <TabsContent value="previous" className="focus-visible:outline-none">
          {isLoadingRecent ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Skeleton className="h-40 w-full bg-muted rounded-xl" />
              <Skeleton className="h-40 w-full bg-muted rounded-xl" />
            </div>
          ) : filteredRecent.length === 0 ? (
            <Card className="bg-card border-border text-foreground rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3.5 shadow-xs border-0 border-b-[0.5px]">
              <div className="bg-muted flex items-center justify-center p-3 rounded-full text-muted-foreground border border-border">
                <VideoOff className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground">No completed meetings</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed font-medium">
                  Completed meetings will render here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredRecent.map((meeting) => (
                <Card 
                  key={meeting.id} 
                  className="bg-card border-border hover:shadow-md transition-all duration-200 rounded-xl flex flex-col justify-between overflow-hidden shadow-xs border-0 border-b-[0.5px]"
                >
                  <CardHeader className="pb-3 pt-4.5 px-4.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex items-center text-[9px] font-bold tracking-wider text-muted-foreground uppercase bg-muted border border-border px-2 py-0.5 rounded-full mb-2 select-none">
                          Completed
                        </span>
                        <CardTitle className="text-xs font-bold text-foreground truncate">{meeting.title}</CardTitle>
                      </div>
                      <span className="text-[9px] bg-background px-2 py-0.5 rounded-md border border-border text-muted-foreground font-mono shrink-0 select-none">
                        {meeting.meeting_id}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-1.5 pb-4 px-4.5 text-muted-foreground text-[11px] font-semibold leading-none">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{format(new Date(meeting.scheduled_at), 'PPP')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {format(new Date(meeting.scheduled_at), 'p')} ({meeting.duration_minutes} minutes)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Host: {meeting.host_name}</span>
                    </div>
                  </CardContent>

                  <div className="border-t border-border/85 p-3.5 bg-background/35 flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider shrink-0 select-none">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {meeting.participants.length} Participant(s)
                    </span>
                    <span className="text-[9px] text-muted-foreground font-bold">
                      Ended
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
