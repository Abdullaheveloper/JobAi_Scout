import { useEffect, useRef, useState, useCallback } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2,
  MessageSquare, Bot, User, Headphones,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID;

type TranscriptEntry = {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
};

function VoiceAgentInner() {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      toast({ title: "Connected", description: "Voice agent is ready. Start speaking!" });
    },
    onDisconnect: () => {
      toast({ title: "Disconnected", description: "Voice agent session ended." });
    },
    onMessage: (message) => {
      if (message.source === "transcript") {
        setTranscript((prev) => [
          ...prev,
          {
            role: message.role === "user" ? "user" : "agent",
            content: message.content,
            timestamp: new Date(),
          },
        ]);
      }
    },
    onError: (error) => {
      console.error("Voice agent error:", error);
      toast({ title: "Error", description: error || "Connection error occurred.", variant: "destructive" });
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Update volume
  useEffect(() => {
    conversation.setVolume({ volume });
  }, [volume, conversation]);

  const handleStart = useCallback(async () => {
    if (!AGENT_ID) {
      toast({
        title: "Configuration Error",
        description: "Voice agent is not configured. Please set VITE_ELEVENLABS_AGENT_ID.",
        variant: "destructive",
      });
      return;
    }

    setIsStarting(true);
    try {
      // Request mic permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get conversation token from edge function
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch(`${FUNCTIONS_URL}/elevenlabs-conversation-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ agentId: AGENT_ID }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get conversation token");
      }

      const { token: conversationToken } = await res.json();

      await conversation.startSession({
        conversationToken,
      });
    } catch (err) {
      console.error("Failed to start voice agent:", err);
      toast({
        title: "Failed to Start",
        description: err instanceof Error ? err.message : "Could not start voice agent.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  }, [conversation, toast]);

  const handleEnd = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  }, [conversation]);

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Voice Agent</h1>
              <p className="text-sm text-muted-foreground">Real-time voice assistant powered by ElevenLabs</p>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
            <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Voice Area */}
          <Card className="lg:col-span-2">
            <CardContent className="p-8">
              {/* Orb / Visualizer */}
              <div className="flex flex-col items-center gap-8">
                <div className="relative">
                  {/* Animated rings */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full transition-all duration-500",
                      isConnected
                        ? "bg-primary/5 scale-110"
                        : "bg-muted/30 scale-100"
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-2 rounded-full transition-all duration-500",
                      isConnected && isSpeaking
                        ? "bg-primary/10 scale-110"
                        : "bg-transparent scale-100"
                    )}
                  />
                  <div
                    className={cn(
                      "absolute inset-4 rounded-full transition-all duration-500",
                      isConnected && isSpeaking
                        ? "bg-primary/15 scale-110"
                        : "bg-transparent scale-100"
                    )}
                  />

                  {/* Center orb */}
                  <div
                    className={cn(
                      "relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-300",
                      isConnected
                        ? isSpeaking
                          ? "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 scale-110"
                          : "bg-gradient-to-br from-primary/80 to-primary/60 shadow-md shadow-primary/15"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {isConnected ? (
                      <Headphones className="h-12 w-12 text-primary-foreground" />
                    ) : (
                      <Mic className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Status text */}
                <div className="text-center">
                  {isConnected ? (
                    isSpeaking ? (
                      <p className="text-lg font-medium text-primary">Agent is speaking...</p>
                    ) : (
                      <p className="text-lg font-medium text-muted-foreground">Listening... speak now</p>
                    )
                  ) : (
                    <p className="text-lg text-muted-foreground">
                      {isStarting ? "Connecting..." : "Press the button to start a voice conversation"}
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  {!isConnected ? (
                    <Button
                      size="lg"
                      onClick={handleStart}
                      disabled={isStarting || !AGENT_ID}
                      className="gap-2 px-8"
                    >
                      {isStarting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Phone className="h-5 w-5" />
                      )}
                      {isStarting ? "Connecting..." : "Start Call"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleEnd}
                        className="gap-2 px-8"
                      >
                        <PhoneOff className="h-5 w-5" />
                        End Call
                      </Button>

                      <Button
                        size="lg"
                        variant={isMuted ? "destructive" : "outline"}
                        onClick={() => {
                          conversation.setMuted(!isMuted);
                          setIsMuted(!isMuted);
                        }}
                      >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>
                    </>
                  )}
                </div>

                {/* Volume control */}
                {isConnected && (
                  <div className="flex items-center gap-3 w-full max-w-xs">
                    <VolumeX className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                )}

                {!AGENT_ID && (
                  <p className="text-sm text-destructive text-center">
                    Agent not configured. Set <code className="bg-muted px-1 rounded">VITE_ELEVENLABS_AGENT_ID</code> in your .env file.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transcript Panel */}
          <Card className="lg:col-span-1">
            <CardContent className="p-4 flex flex-col h-[500px]">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Transcript</span>
              </div>

              <ScrollArea className="flex-1" ref={scrollRef as never}>
                {transcript.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Start a call to see the conversation here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transcript.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex gap-2",
                          entry.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            entry.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {entry.role === "user" ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Bot className="h-3 w-3" />
                            )}
                            <span className="text-xs opacity-70">
                              {entry.role === "user" ? "You" : "Agent"}
                            </span>
                          </div>
                          <p>{entry.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Headphones className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About Voice Agent</p>
                <p>
                  This is a real-time voice assistant powered by ElevenLabs Conversational AI.
                  It can help you with job searching, CV building, interview preparation, and career advice.
                  The assistant uses RAG (Retrieval-Augmented Generation) to provide accurate answers
                  from your indexed knowledge base.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function VoiceAgent() {
  return (
    <ConversationProvider>
      <VoiceAgentInner />
    </ConversationProvider>
  );
}
