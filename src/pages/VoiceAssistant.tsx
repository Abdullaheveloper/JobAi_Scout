import DashboardLayout from "@/components/DashboardLayout";
import { VoiceMode } from "@/components/voice/VoiceMode";

/** The assistant deliberately has no text-chat fallback in its UI. */
export default function VoiceAssistant() {
  return <DashboardLayout><VoiceMode /></DashboardLayout>;
}
