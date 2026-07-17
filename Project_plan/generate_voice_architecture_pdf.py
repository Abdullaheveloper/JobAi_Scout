from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path(__file__).with_name("JobAI_Voice_Assistant_Architecture.pdf")


def bullet(text: str) -> Paragraph:
    return Paragraph(f"&bull; {text}", styles["Body"])


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="TitleCustom", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=23, leading=28, textColor=colors.HexColor("#172554"), alignment=TA_CENTER,
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=10,
    leading=14, textColor=colors.HexColor("#475569"), alignment=TA_CENTER, spaceAfter=20,
))
styles.add(ParagraphStyle(
    name="HeadingCustom", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=15, leading=19, textColor=colors.HexColor("#312e81"), spaceBefore=14, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5,
    leading=14, textColor=colors.HexColor("#1e293b"), spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="CodeBlock", parent=styles["Code"], fontName="Courier", fontSize=8.5,
    leading=12, textColor=colors.HexColor("#0f172a"), backColor=colors.HexColor("#f1f5f9"),
    borderColor=colors.HexColor("#cbd5e1"), borderWidth=0.5, borderPadding=8, spaceBefore=5, spaceAfter=10,
))


def section(title: str, body: list[str]) -> list:
    items = [Paragraph(title, styles["HeadingCustom"])]
    items.extend(Paragraph(text, styles["Body"]) for text in body)
    return items


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
    canvas.line(1.6 * cm, 1.45 * cm, A4[0] - 1.6 * cm, 1.45 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(1.6 * cm, 0.9 * cm, "JobAI Scout - Voice Assistant Architecture")
    canvas.drawRightString(A4[0] - 1.6 * cm, 0.9 * cm, f"Page {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT), pagesize=A4, leftMargin=1.7 * cm, rightMargin=1.7 * cm,
    topMargin=1.6 * cm, bottomMargin=1.9 * cm,
)

story = [
    Spacer(1, 0.6 * cm),
    Paragraph("JobAI Scout Voice Assistant", styles["TitleCustom"]),
    Paragraph("Architecture, implementation, data flow, rules, testing, and operations", styles["Subtitle"]),
    Paragraph("Purpose", styles["HeadingCustom"]),
    Paragraph(
        "The JobAI Scout Voice Assistant lets an authenticated user speak a career question, "
        "receive a Gemini-powered answer, and hear that answer spoken aloud. It can also use "
        "the user's uploaded documents as a private retrieval-augmented generation (RAG) knowledge base.",
        styles["Body"],
    ),
    Paragraph("High-Level Architecture", styles["HeadingCustom"]),
    Paragraph(
        "Browser microphone -> browser speech recognition -> Gemini transcription fallback -> "
        "Gemini embedding and RAG retrieval -> Gemini chat answer -> Gemini text-to-speech -> browser playback and history storage.",
        styles["CodeBlock"],
    ),
]

architecture_rows = [
    ["Layer", "Component", "Responsibility"],
    ["Client", "VoiceMode", "Records microphone input, detects end of speech, requests transcription/chat/TTS, and plays audio."],
    ["Client", "VoiceRecognition", "Uses Chrome or Edge Web Speech API first for fast local transcript capture."],
    ["Edge", "voice-transcribe", "Uses Gemini only when browser speech recognition has no final transcript."],
    ["Edge", "voice-chat", "Authenticates the user, retrieves relevant knowledge chunks, calls Gemini, persists messages, and caches useful answers."],
    ["Edge", "voice-tts", "Converts the final answer to speech using Gemini TTS."],
    ["Database", "kb_sources / kb_chunks", "Stores uploaded source metadata, chunk text, and vector embeddings for RAG."],
    ["Storage", "voice-history", "Stores optional user and assistant audio after the response path is already running."],
]
architecture = Table(architecture_rows, colWidths=[2.1 * cm, 3.2 * cm, 11.0 * cm], repeatRows=1)
architecture.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#312e81")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("LEADING", (0, 0), (-1, -1), 10),
    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story += [architecture]

story += section("How a Voice Turn Works", [
    "1. The user taps the microphone. The browser requests microphone permission and starts both MediaRecorder and browser speech recognition when available.",
    "2. The voice activity detector waits for actual speech. It does not end a turn immediately because the user paused before talking.",
    "3. After speech begins, 2.2 seconds of silence ends the turn. If the user never speaks, the microphone ends after 3 seconds with a clear no-speech message. A second tap while listening stops recording immediately.",
    "4. The browser transcript is used first. If there is no final browser transcript, the recording is sent to Gemini transcription.",
    "5. The text question is sent to voice-chat. Short conversations avoid an unnecessary query-rewrite request to reduce latency.",
    "6. voice-chat produces a Gemini embedding, searches the user's private knowledge-base chunks, adds relevant context, and requests a concise Gemini answer.",
    "7. The final answer is sent to Gemini TTS and played immediately. Background history uploads do not block the response.",
])

story += section("RAG Document Flow", [
    "A PDF, TXT, DOC, DOCX, Markdown, or CSV file is uploaded through the Voice Assistant knowledge button.",
    "kb-ingest-document extracts readable text, cleans it, splits it into bounded chunks, and creates a Gemini embedding for every chunk.",
    "The source record is stored in kb_sources and the text plus vectors are stored in kb_chunks. A ready source means the document is available for retrieval.",
    "For a voice question, the same embedding model creates a query vector. Database functions retrieve the closest chunks for that authenticated user only.",
])

story += section("Implementation Decisions", [
    "Gemini is the AI provider for transcription fallback, embeddings, chat, and TTS. The former OpenRouter audio-balance dependency was removed from the user-facing voice path.",
    "Browser speech recognition is preferred because it avoids sending audio to the server and usually returns text faster than server transcription.",
    "Storage writes are asynchronous after the response begins. This protects perceived response speed while retaining history when storage is available.",
    "Voice answers are capped at 480 output tokens. Voice replies should be concise, useful, and natural to hear.",
    "Knowledge retrieval is scoped to the logged-in user through database policies and user identifiers passed to the matching functions.",
])

story.append(PageBreak())
story += section("Rules and Safety Controls", [
    "Authentication: voice-chat requires an authenticated Supabase user before it reads history, documents, or writes messages.",
    "Data isolation: RAG retrieval only searches the current user's knowledge-base chunks. The assistant must not expose another user's documents, profile, or history.",
    "Secrets: Gemini and service credentials are stored as Supabase secrets or ignored local environment values. They must never be placed in client code, browser storage, logs, or this document.",
    "Consent: microphone access depends on browser permission. The user controls recording by tapping the microphone again.",
    "No fabrication: if context is missing, the assistant should not invent document content, pricing, platform policies, or private information.",
    "Input defense: prompts are sanitized before the chat request, and the assistant has career-focused guardrails.",
    "Fallback behavior: no browser transcript uses Gemini transcription; a Gemini TTS failure falls back to browser speech synthesis; no speech shows a clear retry message.",
])

story += section("Testing Performed", [
    "Gemini text generation was verified with a minimal server-side request.",
    "Gemini embedding generation was verified at the configured 1,536 vector dimensions.",
    "Document RAG ingestion was verified through a successful uploaded-document ready state and the kb_sources / kb_chunks storage flow.",
    "The kb-ingest-document bug was corrected: insert results are now read directly instead of calling select() on an already resolved result object.",
    "voice-transcribe, voice-chat, voice-agent-llm, and kb-ingest-document were deployed after their relevant changes.",
    "The frontend production build completed successfully after voice flow changes.",
    "Voice-flow regression checks confirm the 3-second no-speech timeout, second-click stop control, removed obsolete OpenRouter error text, and latency settings.",
])

story += section("Manual Acceptance Test", [
    "1. Sign in, open Dashboard -> Voice Assistant, and allow microphone access.",
    "2. Tap the microphone, speak one short question, then remain silent. The turn should end after about 2.2 seconds of post-speech silence.",
    "3. Confirm that the assistant starts processing and plays an answer. Repeat with a question whose answer exists only in an uploaded document.",
    "4. In Supabase, verify kb_sources shows status ready and kb_chunks contains rows with embeddings for the uploaded file.",
    "5. Tap the microphone and do not speak. It should stop after 3 seconds and show a no-speech message. Tap while listening to stop immediately.",
])

story += section("Operational Notes", [
    "The first Gemini request can take longer than later requests because of provider cold-start and network latency. Browser transcript, concise answers, caching, and non-blocking history writes reduce the normal path delay.",
    "A live microphone test still requires a real signed-in browser session with microphone permission. Automated validation can verify builds, functions, embeddings, and API behavior, but cannot speak into the user's microphone.",
])

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
