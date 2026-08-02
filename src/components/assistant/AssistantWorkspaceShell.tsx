import { PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Expand, History, LoaderCircle, MessageSquare, Mic, Minimize2, PanelRightOpen, Plus, Send, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getVisibleJobId } from "@/lib/assistant/screen-context";
import { runAssistantTurn, type AssistantMessage } from "@/lib/assistant/agent";
import { VoiceRecognition } from "@/lib/voice/recognition";
import { voiceSynthesis } from "@/lib/voice/synthesis";
import { VoiceActivityDetector } from "@/lib/voice/vad";
import { isStopCommand, shouldSpeakAssistantResponse, speechText, type AssistantVoiceState } from "@/lib/assistant/voice-state";
import type { ConfirmationDecision, ConfirmationRequest } from "@/lib/assistant/tools";
import { appendAssistantMessage, compactMemoryContext, createAssistantSession, loadAssistantMemory, type AssistantSession, type MemoryBootstrap } from "@/lib/assistant/memory";

const DESKTOP_RATIO_KEY = "jobai-assistant-desktop-ratio";
const MOBILE_RATIO_KEY = "jobai-assistant-mobile-ratio";
const DEFAULT_DESKTOP_RATIO = 30;
const DEFAULT_MOBILE_RATIO = 30;

const readRatio = (key: string, fallback: number) => {
  const stored = window.localStorage.getItem(key);
  if (stored === null || stored.trim() === "") return fallback;
  const value = Number(stored);
  return Number.isFinite(value) ? Math.min(60, Math.max(20, value)) : fallback;
};

type IconButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
};

function IconButton({ label, onClick, children, active, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors",
        "hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

export function AssistantWorkspaceShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const shellRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const liveMessageIdRef = useRef<string | null>(null);
  const liveTranscriptRef = useRef("");
  const committedTranscriptRef = useRef("");
  const speakingMessageIdRef = useRef<string | null>(null);
  const messagesRef = useRef<AssistantMessage[]>([]);
  const runningRef = useRef(false);
  const voiceStateRef = useRef<AssistantVoiceState>("idle");
  const confirmationResolverRef = useRef<((decision: ConfirmationDecision) => void) | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const [desktopRatio, setDesktopRatio] = useState(() => readRatio(DESKTOP_RATIO_KEY, DEFAULT_DESKTOP_RATIO));
  const [mobileRatio, setMobileRatio] = useState(() => readRatio(MOBILE_RATIO_KEY, DEFAULT_MOBILE_RATIO));
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [voiceState, setVoiceState] = useState<AssistantVoiceState>("idle");
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);
  const [scopeAcknowledgement, setScopeAcknowledgement] = useState("");
  const [memory, setMemory] = useState<MemoryBootstrap | null>(null);
  const [session, setSession] = useState<AssistantSession | null>(null);
  const [usageNearLimit, setUsageNearLimit] = useState(false);
  const [memoryError, setMemoryError] = useState("");

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    if (historyOpen) return;
    const frame = window.requestAnimationFrame(() => messageEndRef.current?.scrollIntoView({ block: "nearest" }));
    return () => window.cancelAnimationFrame(frame);
  }, [messages, pendingConfirmation, usageNearLimit, memoryError, historyOpen]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadAssistantMemory();
        const created = await createAssistantSession();
        if (!cancelled) { setMemory(loaded); setSession(created.session); }
      } catch (error) {
        if (!cancelled) setMemoryError(error instanceof Error ? error.message : "Assistant memory could not be loaded.");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const updateMessages = (updater: (current: AssistantMessage[]) => AssistantMessage[]) => {
    setMessages((current) => {
      const next = updater(current);
      messagesRef.current = next;
      return next;
    });
  };

  const setRunning = (value: boolean) => {
    runningRef.current = value;
    setIsRunning(value);
  };

  const setVoice = (value: AssistantVoiceState) => {
    voiceStateRef.current = value;
    setVoiceState(value);
  };

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const ratio = expanded ? 50 : isMobile ? mobileRatio : desktopRatio;

  const resizeFromPointer = useCallback((clientX: number, clientY: number) => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;

    const next = isMobile
      ? ((rect.bottom - clientY) / rect.height) * 100
      : ((rect.right - clientX) / rect.width) * 100;
    const bounded = Math.min(60, Math.max(20, next));
    setExpanded(false);
    if (isMobile) {
      setMobileRatio(bounded);
      window.localStorage.setItem(MOBILE_RATIO_KEY, String(bounded));
    } else {
      setDesktopRatio(bounded);
      window.localStorage.setItem(DESKTOP_RATIO_KEY, String(bounded));
    }
  }, [isMobile]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent) => resizeFromPointer(moveEvent.clientX, moveEvent.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = isMobile ? "row-resize" : "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const resizeWithKeyboard = (delta: number) => {
    const next = Math.min(60, Math.max(20, ratio + delta));
    setExpanded(false);
    if (isMobile) {
      setMobileRatio(next);
      window.localStorage.setItem(MOBILE_RATIO_KEY, String(next));
    } else {
      setDesktopRatio(next);
      window.localStorage.setItem(DESKTOP_RATIO_KEY, String(next));
    }
  };

  const close = () => {
    if (confirmationResolverRef.current) {
      confirmationResolverRef.current({ decision: "cancel" });
      confirmationResolverRef.current = null;
      setPendingConfirmation(null);
    }
    setOpen(false);
    setHistoryOpen(false);
  };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  };

  const markSpokenResponseInterrupted = () => {
    const messageId = speakingMessageIdRef.current;
    if (!messageId) return;
    updateMessages((current) => current.map((message) => message.id === messageId ? { ...message, interrupted: true } : message));
    speakingMessageIdRef.current = null;
  };

  const stop = () => {
    if (confirmationResolverRef.current) {
      confirmationResolverRef.current({ decision: "cancel" });
      confirmationResolverRef.current = null;
      setPendingConfirmation(null);
    }
    clearSilenceTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    vadRef.current?.stop();
    vadRef.current = null;
    if (voiceStateRef.current === "speaking") markSpokenResponseInterrupted();
    voiceSynthesis.stop();
    abortRef.current?.abort();
    abortRef.current = null;
    if (liveMessageIdRef.current) {
      const liveId = liveMessageIdRef.current;
      updateMessages((current) => current.filter((message) => message.id !== liveId || Boolean(message.content.trim())));
    }
    liveMessageIdRef.current = null;
    liveTranscriptRef.current = "";
    committedTranscriptRef.current = "";
    setRunning(false);
    setVoice("idle");
  };

  const startNewChat = async () => {
    stop();
    try {
      const created = await createAssistantSession();
      setSession(created.session);
      setMessages([]);
      messagesRef.current = [];
      setUsageNearLimit(false);
      setHistoryOpen(false);
      setMemoryError("");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "A new chat could not be started.");
    }
  };

  const requestConfirmation = (request: ConfirmationRequest) => new Promise<ConfirmationDecision>((resolve) => {
    confirmationResolverRef.current = resolve;
    setScopeAcknowledgement("");
    setPendingConfirmation(request);
  });

  const decideConfirmation = (decision: "confirm" | "cancel") => {
    const resolve = confirmationResolverRef.current;
    if (!resolve) return;
    resolve({ decision, acknowledgement: decision === "confirm" ? scopeAcknowledgement : undefined });
    confirmationResolverRef.current = null;
    setPendingConfirmation(null);
    setScopeAcknowledgement("");
  };

  const speakAnswer = async (content: string, messageId: string) => {
    const speakable = speechText(content);
    if (!speakable || !("speechSynthesis" in window)) {
      setVoice("idle");
      return;
    }
    speakingMessageIdRef.current = messageId;
    setVoice("speaking");

    // Browser VAD provides first-pass automatic barge-in. The audio adapters can
    // later be swapped for Deepgram/ElevenLabs without changing the agent loop.
    const vad = new VoiceActivityDetector({
      silenceThreshold: 0.06,
      minSpeechMs: 180,
      minRecordMs: 180,
      onSpeechStart: () => {
        if (voiceStateRef.current === "speaking") void startListening(true);
      },
    });
    vadRef.current = vad;
    window.setTimeout(() => {
      if (voiceStateRef.current === "speaking" && vadRef.current === vad) void vad.start();
    }, 350);

    await voiceSynthesis.speak(speakable, {
      language: i18n.resolvedLanguage || i18n.language || "en",
      onEnd: () => {
        if (voiceStateRef.current === "speaking") {
          vadRef.current?.stop();
          vadRef.current = null;
          speakingMessageIdRef.current = null;
          setVoice("idle");
        }
      },
      onError: () => {
        if (voiceStateRef.current === "speaking") setVoice("idle");
      },
    });
  };

  const interruptVoiceForText = () => {
    if (voiceStateRef.current !== "speaking") return;
    markSpokenResponseInterrupted();
    vadRef.current?.stop();
    vadRef.current = null;
    voiceSynthesis.stop();
    setVoice("idle");
  };

  const submitMessage = async (content: string, mode: "text" | "voice", existingUserId?: string) => {
    const trimmed = content.trim();
    if (mode === "text") interruptVoiceForText();
    if (!trimmed || runningRef.current) return;
    if (!session) {
      setMemoryError("Assistant memory is still loading. Please try again in a moment.");
      return;
    }
    if (isStopCommand(trimmed)) {
      stop();
      setDraft("");
      return;
    }

    const userMessage: AssistantMessage = { id: existingUserId || crypto.randomUUID(), role: "user", content: trimmed };
    let nextHistory: AssistantMessage[];
    if (existingUserId) {
      nextHistory = messagesRef.current.map((message) => message.id === existingUserId ? { ...userMessage, live: false } : message);
    } else {
      nextHistory = [...messagesRef.current, userMessage];
    }
    const assistantId = crypto.randomUUID();
    const assistantMessage: AssistantMessage = { id: assistantId, role: "assistant", content: "", statuses: [] };
    updateMessages(() => [...nextHistory, assistantMessage]);
    setDraft("");
    setRunning(true);
    if (mode === "voice") setVoice("processing");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await appendAssistantMessage(session.id, "user", trimmed);
      const response = await runAssistantTurn({
        history: nextHistory,
        screen: {
          route: `${location.pathname}${location.search}`,
          visible_job_id: getVisibleJobId(),
          role,
        },
        navigate,
        signal: controller.signal,
        requestConfirmation,
        sessionId: session.id,
        memoryContext: compactMemoryContext(memory, session.id),
        onUsage: (usage) => {
          setSession((current) => current ? { ...current, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens } : current);
          setUsageNearLimit(usage.near_limit);
        },
        onToolResult: ({ ui_update, result, linked_tool_call }) => {
          updateMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, statuses: [...(message.statuses || []), ui_update] }
            : message));
          if (linked_tool_call) void appendAssistantMessage(session.id, "tool", JSON.stringify(result), linked_tool_call).catch((error) => setMemoryError(error instanceof Error ? error.message : "Tool history could not be saved."));
        },
      });
      updateMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: response } : message));
      void appendAssistantMessage(session.id, "assistant", response)
        .then(() => loadAssistantMemory())
        .then(setMemory)
        .catch((error) => setMemoryError(error instanceof Error ? error.message : "Assistant history could not be saved."));
      if (shouldSpeakAssistantResponse(mode) && voiceStateRef.current === "processing") {
        setRunning(false);
        if (abortRef.current === controller) abortRef.current = null;
        await speakAnswer(response, assistantId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateMessages((current) => current.filter((message) => message.id !== assistantId));
      } else {
        const errorMessage = error instanceof Error ? error.message : t("assistantShell.error");
        if ((error as Error & { code?: string })?.code === "SESSION_LIMIT") setUsageNearLimit(true);
        updateMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: errorMessage } : message));
        setVoice("idle");
        if (shouldSpeakAssistantResponse(mode)) await speakAnswer(errorMessage, assistantId);
      }
    } finally {
      if (abortRef.current === controller) {
        setRunning(false);
        abortRef.current = null;
      }
    }
  };

  const finalizeListening = () => {
    if (voiceStateRef.current !== "listening") return;
    clearSilenceTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    const transcript = liveTranscriptRef.current.trim();
    const messageId = liveMessageIdRef.current;
    liveMessageIdRef.current = null;
    if (!transcript || !messageId) {
      const noSpeech = t("assistantShell.noSpeech", { defaultValue: "I couldn't recognize any speech. Please try again." });
      if (messageId) updateMessages((current) => current.map((message) => message.id === messageId ? { ...message, role: "assistant", content: noSpeech, live: false } : message));
      setVoice("idle");
      if (messageId) void speakAnswer(noSpeech, messageId);
      return;
    }
    if (isStopCommand(transcript)) {
      updateMessages((current) => current.filter((message) => message.id !== messageId));
      stop();
      return;
    }
    setVoice("processing");
    void submitMessage(transcript, "voice", messageId);
  };

  async function startListening(bargeIn = false) {
    if (bargeIn || voiceStateRef.current === "speaking") {
      markSpokenResponseInterrupted();
      voiceSynthesis.stop();
    }
    vadRef.current?.stop();
    vadRef.current = null;
    recognitionRef.current?.stop();
    clearSilenceTimer();
    const recognition = new VoiceRecognition();
    recognitionRef.current = recognition;
    liveTranscriptRef.current = "";
    committedTranscriptRef.current = "";
    const messageId = crypto.randomUUID();
    liveMessageIdRef.current = messageId;
    updateMessages((current) => [...current, { id: messageId, role: "user", content: "", live: true }]);
    setOpen(true);
    setVoice("listening");

    const started = recognition.start({
      language: i18n.resolvedLanguage || i18n.language || "en",
      continuous: true,
      interimResults: true,
      onResult: (transcript, isFinal) => {
        if (voiceStateRef.current !== "listening") return;
        if (isFinal) committedTranscriptRef.current = `${committedTranscriptRef.current} ${transcript}`.trim();
        const combined = isFinal ? committedTranscriptRef.current : `${committedTranscriptRef.current} ${transcript}`.trim();
        liveTranscriptRef.current = combined;
        updateMessages((current) => current.map((message) => message.id === messageId ? { ...message, content: combined } : message));
        if (isStopCommand(combined)) {
          stop();
          return;
        }
        clearSilenceTimer();
        silenceTimerRef.current = window.setTimeout(finalizeListening, 2_000);
      },
      onError: (error) => {
        updateMessages((current) => current.map((message) => message.id === messageId ? { ...message, role: "assistant", content: error, live: false } : message));
        setVoice("idle");
        void speakAnswer(error, messageId);
      },
    });
    if (!started) {
      updateMessages((current) => current.map((message) => message.id === messageId ? { ...message, role: "assistant", content: t("assistantShell.voiceUnsupported"), live: false } : message));
      setVoice("idle");
      void speakAnswer(t("assistantShell.voiceUnsupported"), messageId);
    }
  }

  const onMicClick = () => {
    if (voiceStateRef.current === "idle" && runningRef.current) {
      stop();
      void startListening();
    } else if (voiceStateRef.current === "idle") void startListening();
    else if (voiceStateRef.current === "listening") finalizeListening();
    else if (voiceStateRef.current === "speaking") void startListening(true);
  };

  const sendMessage = () => void submitMessage(draft, "text");
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, AssistantSession[]>();
    for (const item of memory?.sessions || []) {
      const day = new Intl.DateTimeFormat(i18n.resolvedLanguage || "en", { dateStyle: "medium" }).format(new Date(item.updated_at));
      groups.set(day, [...(groups.get(day) || []), item]);
    }
    return [...groups.entries()];
  }, [memory?.sessions, i18n.resolvedLanguage]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    vadRef.current?.stop();
    voiceSynthesis.stop();
    clearSilenceTimer();
    abortRef.current?.abort();
  }, []);

  const toolbar = (
    <div
      className="fixed bottom-4 end-4 z-[70] flex items-center gap-0.5 rounded-xl border border-border/70 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl"
      style={open ? (isMobile
        ? { bottom: `calc(${ratio}% + 0.75rem)` }
        : { insetInlineEnd: `calc(${ratio}% + 0.75rem)` }) : undefined}
      aria-label={t("assistantShell.controls")}
    >
      <IconButton label={t("assistantShell.open")} active={open} onClick={() => setOpen(true)}>
        <PanelRightOpen className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("assistantShell.microphone")} active={voiceState === "listening" || voiceState === "speaking"} onClick={onMicClick}>
        <Mic className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("assistantShell.history")} active={historyOpen} onClick={() => { setOpen(true); setHistoryOpen((value) => !value); }}>
        <History className="h-4 w-4" />
      </IconButton>
      <IconButton label={t(expanded ? "assistantShell.collapse" : "assistantShell.expand")} onClick={() => { setOpen(true); setExpanded((value) => !value); }}>
        {expanded ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
      </IconButton>
      <IconButton label={t("assistantShell.stop")} disabled={voiceState !== "listening" && voiceState !== "speaking" && !isRunning} onClick={stop}>
        <Square className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("assistantShell.close")} disabled={!open} onClick={close}>
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  );

  if (!open) {
    return <div className="relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">{children}{toolbar}</div>;
  }

  return (
    <div ref={shellRef} className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden md:flex-row">
      <section
        aria-label={t("assistantShell.liveSite")}
        className="order-1 min-h-0 min-w-0 overflow-auto md:order-1"
        style={isMobile ? { height: `${100 - ratio}%` } : { width: `${100 - ratio}%` }}
      >
        {children}
      </section>

      <div
        role="separator"
        aria-label={t("assistantShell.resize")}
        aria-orientation={isMobile ? "horizontal" : "vertical"}
        aria-valuemin={20}
        aria-valuemax={60}
        aria-valuenow={Math.round(ratio)}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={(event) => {
          if (event.key === (isMobile ? "ArrowUp" : "ArrowLeft")) resizeWithKeyboard(2);
          if (event.key === (isMobile ? "ArrowDown" : "ArrowRight")) resizeWithKeyboard(-2);
        }}
        className="group order-2 z-20 flex h-2 shrink-0 cursor-row-resize items-center justify-center bg-border/70 outline-none hover:bg-primary/30 focus-visible:bg-primary/40 md:h-auto md:w-2 md:cursor-col-resize"
      >
        <span className="h-1 w-12 rounded-full bg-muted-foreground/50 group-hover:bg-primary md:h-12 md:w-1" />
      </div>

      <aside
        aria-label={t("assistantShell.panel")}
        className="order-3 flex min-h-0 min-w-0 flex-col overflow-hidden bg-card md:order-3"
        style={isMobile ? { height: `${ratio}%` } : { width: `${ratio}%` }}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{t("assistantShell.title")}</h2>
              <p className="truncate text-xs text-muted-foreground">{t(`assistantShell.state_${voiceState}`)}</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label={t("assistantShell.close")} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void startNewChat()} aria-label={t("assistantShell.newChat", { defaultValue: "New chat" })} title={t("assistantShell.newChat", { defaultValue: "New chat" })} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </header>

        <div ref={messageListRef} data-testid="assistant-message-list" className="min-h-0 flex-1 overscroll-contain overflow-y-auto overflow-x-hidden px-4 pb-6 pt-4 scroll-pb-6" aria-live="polite">
          {historyOpen ? (
            <div className="space-y-5">
              <section>
                <h3 className="text-sm font-semibold text-foreground">{t("assistantShell.profileMemory", { defaultValue: "Remembered preferences" })}</h3>
                {memory?.profile_memory.length ? <dl className="mt-2 space-y-2 rounded-xl bg-muted p-3 text-xs">
                  {memory.profile_memory.map((item) => <div key={item.memory_key}><dt className="font-medium capitalize text-foreground">{item.memory_key.replaceAll("_", " ")}</dt><dd className="mt-0.5 break-words text-muted-foreground">{typeof item.memory_value === "string" ? item.memory_value : JSON.stringify(item.memory_value)}</dd></div>)}
                </dl> : <p className="mt-2 text-xs text-muted-foreground">{t("assistantShell.noMemory", { defaultValue: "No durable preferences saved yet." })}</p>}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-foreground">{t("assistantShell.historyTitle")}</h3>
                {sessionGroups.length ? <div className="mt-2 space-y-4">{sessionGroups.map(([day, items]) => <div key={day}><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</p>{items.map((item) => <div key={item.id} className="mb-1 rounded-lg border border-border p-2 text-xs"><p className="font-medium text-foreground">{item.title || t("assistantShell.chatSession", { defaultValue: "Assistant chat" })}</p><p className="text-muted-foreground">{new Intl.DateTimeFormat(i18n.resolvedLanguage || "en", { timeStyle: "short" }).format(new Date(item.updated_at))} · {item.input_tokens.toLocaleString()} in / {item.output_tokens.toLocaleString()} out</p></div>)}</div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{t("assistantShell.historyEmpty")}</p>}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-foreground">{t("assistantShell.recentActions", { defaultValue: "Recent actions" })}</h3>
                <div className="mt-2 space-y-1">{memory?.actions.slice(0, 10).map((action, index) => <div key={`${action.created_at}-${index}`} className="rounded-lg border border-border p-2 text-xs"><p className="font-medium text-foreground">{action.action_type.replaceAll("_", " ")}</p><p className="text-muted-foreground">{new Date(action.created_at).toLocaleString()}</p></div>)}</div>
              </section>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <MessageSquare className="mb-3 h-8 w-8 opacity-50" />
              <p className="text-sm font-medium text-foreground">{t("assistantShell.emptyTitle")}</p>
              <p className="mt-1 max-w-xs text-xs">{t("assistantShell.emptyBody")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {memoryError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{memoryError}</div>}
              {usageNearLimit && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p className="font-medium">{t("assistantShell.tokenWarning", { defaultValue: "This chat is nearing its token limit. Start a new chat soon to avoid interruption." })}</p><button type="button" onClick={() => void startNewChat()} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{t("assistantShell.newChat", { defaultValue: "New chat" })}</button></div>}
              {messages.map((message) => (
                <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}>
                    {message.statuses?.map((status, index) => (
                      <div key={`${status}-${index}`} className="mb-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        <span>{status}</span>
                      </div>
                    ))}
                    {message.interrupted && (
                      <p className="mb-1 text-[11px] italic text-muted-foreground">{t("assistantShell.interrupted")}</p>
                    )}
                    {message.content ? <p className="whitespace-pre-wrap" dir="auto">{message.content}</p> : (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {message.live ? <Mic className="h-3.5 w-3.5 animate-pulse" /> : <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                        {message.live ? t("assistantShell.listening") : t("assistantShell.thinking")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {pendingConfirmation && (
                <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm" aria-label={t("assistantShell.confirmationLabel", { defaultValue: "Action confirmation" })}>
                  <p className="font-semibold text-foreground">{pendingConfirmation.title}</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {pendingConfirmation.details.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                  {pendingConfirmation.permission_tier === "strong_confirm" && (
                    <label className="mt-3 block text-xs text-foreground">
                      {t("assistantShell.typeToConfirm", { defaultValue: "Type" })} <span className="font-semibold">{pendingConfirmation.acknowledgement || pendingConfirmation.scope}</span> {t("assistantShell.acknowledgeScope", { defaultValue: "to acknowledge the full scope." })}
                      <input value={scopeAcknowledgement} onChange={(event) => setScopeAcknowledgement(event.target.value)} className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/30" />
                    </label>
                  )}
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => decideConfirmation("cancel")} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">{t("assistantShell.cancel", { defaultValue: "Cancel" })}</button>
                    <button type="button" onClick={() => decideConfirmation("confirm")} disabled={pendingConfirmation.permission_tier === "strong_confirm" && scopeAcknowledgement !== (pendingConfirmation.acknowledgement || pendingConfirmation.scope)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{t("assistantShell.confirm", { defaultValue: "Confirm" })}</button>
                  </div>
                </section>
              )}
              <div ref={messageEndRef} className="h-px" aria-hidden="true" />
            </div>
          )}
        </div>

        <form data-testid="assistant-composer" className="sticky bottom-0 z-30 mt-auto shrink-0 border-t border-border bg-card/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-18px_hsl(var(--foreground)/0.35)] backdrop-blur-xl" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-primary/30">
            <textarea
              aria-label={t("assistantShell.messageLabel")}
              placeholder={t("assistantShell.messagePlaceholder")}
              rows={1}
              value={draft}
              disabled={isRunning || voiceState === "listening" || voiceState === "processing"}
              onFocus={interruptVoiceForText}
              onChange={(event) => { interruptVoiceForText(); setDraft(event.target.value); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={onMicClick} aria-label={t("assistantShell.useMicrophone")} className={cn("rounded-lg p-2 text-muted-foreground hover:bg-muted", (voiceState === "listening" || voiceState === "speaking") && "bg-primary/10 text-primary")}>
              <Mic className="h-4 w-4" />
            </button>
            <button type="submit" disabled={isRunning || voiceState === "listening" || voiceState === "processing" || !draft.trim()} aria-label={t("assistantShell.send")} className="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
              {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </aside>

      {toolbar}
    </div>
  );
}
