'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Settings, 
  Video, 
  Volume2, 
  Shield, 
  Sliders,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  // Local state for mock toggles
  const [hdVideo, setHdVideo] = useState(true);
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [autoMute, setAutoMute] = useState(false);

  const handleSave = () => {
    toast.success('Preferences saved successfully!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground text-xs mt-1 font-medium leading-relaxed">
          Configure default video preferences, sound settings, and security controls for your conference workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Hand Navigation list mockup */}
        <div className="space-y-1.5">
          <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-200/50 dark:bg-zinc-800/50 text-foreground flex items-center gap-2 transition-all">
            <Sliders className="h-4 w-4 text-primary" />
            General Preferences
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-zinc-150/40 dark:hover:bg-zinc-800/15 flex items-center gap-2 transition-all cursor-not-allowed">
            <Video className="h-4 w-4" />
            Video Diagnostics
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-zinc-150/40 dark:hover:bg-zinc-800/15 flex items-center gap-2 transition-all cursor-not-allowed">
            <Volume2 className="h-4 w-4" />
            Audio & Devices
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-zinc-150/40 dark:hover:bg-zinc-800/15 flex items-center gap-2 transition-all cursor-not-allowed">
            <Shield className="h-4 w-4" />
            Privacy & Trust
          </button>
        </div>

        {/* Right Hand Configurations panels */}
        <div className="md:col-span-2 space-y-4">
          <Card className="bg-card border-border text-foreground rounded-xl overflow-hidden shadow-xs border-0 border-b-[0.5px]">
            <CardHeader className="pb-3 pt-4 px-5 border-b border-border/80">
              <CardTitle className="text-xs font-bold text-foreground">General Configuration</CardTitle>
              <CardDescription className="text-muted-foreground text-[10px] mt-0.5 leading-relaxed font-semibold">
                Setup parameters applied when launching or connecting to rooms.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Option 1 */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-xs font-bold text-foreground block">HD Stream Quality</Label>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block leading-relaxed font-semibold">
                    Acquire video camera input at 720p by default (increases bandwidth).
                  </span>
                </div>
                <button 
                  onClick={() => setHdVideo(!hdVideo)} 
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {hdVideo ? (
                    <ToggleRight className="h-8 w-8 text-primary" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-zinc-400" />
                  )}
                </button>
              </div>

              {/* Option 2 */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
                <div>
                  <Label className="text-xs font-bold text-foreground block">Background Noise Cancellation</Label>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block leading-relaxed font-semibold">
                    Filter peripheral microphone frequency noise (CPU intensive).
                  </span>
                </div>
                <button 
                  onClick={() => setNoiseCancellation(!noiseCancellation)} 
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {noiseCancellation ? (
                    <ToggleRight className="h-8 w-8 text-primary" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-zinc-400" />
                  )}
                </button>
              </div>

              {/* Option 3 */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
                <div>
                  <Label className="text-xs font-bold text-foreground block">Auto-Mute on Join</Label>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block leading-relaxed font-semibold">
                    Mute your microphone track automatically when entering a room.
                  </span>
                </div>
                <button 
                  onClick={() => setAutoMute(!autoMute)} 
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {autoMute ? (
                    <ToggleRight className="h-8 w-8 text-primary" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-zinc-400" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon details */}
          <div className="bg-zinc-100 dark:bg-zinc-800/30 border border-border p-3.5 rounded-xl text-center">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">More controls Coming Soon</span>
            <p className="text-[9px] text-muted-foreground/80 mt-1 leading-relaxed">Account billing, notification sound controls, and integration pipelines are in active development.</p>
          </div>

          {/* Action Row */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-8.5 px-4 rounded-lg shadow-sm transition-all duration-150 active:scale-98 cursor-pointer"
            >
              Save Preferences
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
