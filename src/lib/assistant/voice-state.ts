export type AssistantVoiceState = "idle" | "listening" | "processing" | "speaking";
export type AssistantInteractionMode = "text" | "voice";

export const shouldSpeakAssistantResponse = (mode: AssistantInteractionMode) => mode === "voice";

export const isStopCommand = (transcript: string) => transcript.trim().toLocaleLowerCase().replace(/[.!?,;:]+$/g, "") === "stop";

export const speechText = (message: string) => message
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/[*_#`>~-]/g, "")
  .replace(/\s+/g, " ")
  .trim();
