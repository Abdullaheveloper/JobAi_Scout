# Voice Agent Deployment Script
# Run this in the project directory: .\deploy-voice-agent.ps1

Write-Host "=== JobAI Voice Agent Deployment ===" -ForegroundColor Cyan
Write-Host ""

$envPath = ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "FAILED: .env file not found in project root." -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envPath -Raw
$supabaseUrlMatch = [regex]::Match($envContent, 'VITE_SUPABASE_URL="?([^"`r`n]+)"?')
$supabaseUrl = if ($supabaseUrlMatch.Success) { $supabaseUrlMatch.Groups[1].Value.Trim('"') } else { "" }
if (-not $supabaseUrl) {
    Write-Host "FAILED: VITE_SUPABASE_URL is missing in .env." -ForegroundColor Red
    exit 1
}

# Step 1: Deploy Supabase Edge Functions
Write-Host "[1/4] Deploying edge functions..." -ForegroundColor Yellow
supabase functions deploy voice-agent-llm
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: Could not deploy voice-agent-llm" -ForegroundColor Red; exit 1 }

supabase functions deploy voice-agent-guard
if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: Could not deploy voice-agent-guard" -ForegroundColor Red; exit 1 }

Write-Host "Edge functions deployed!" -ForegroundColor Green

# Step 2: Set ElevenLabs API key as Supabase secret
Write-Host "[2/4] Setting ElevenLabs API key secret..." -ForegroundColor Yellow
$apiKey = Read-Host "Paste your ElevenLabs API key" -AsSecureString
$apiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))
if (-not $apiKeyPlain) {
    Write-Host "FAILED: ElevenLabs API key is required." -ForegroundColor Red
    exit 1
}
supabase secrets set ELEVENLABS_API_KEY=$apiKeyPlain
Write-Host "Secret set!" -ForegroundColor Green

# Step 3: Ask for Agent ID
Write-Host "[3/4] ElevenLabs Agent Setup" -ForegroundColor Yellow
Write-Host ""
Write-Host "You need to create an ElevenLabs agent:" -ForegroundColor White
Write-Host "  1. Go to https://elevenlabs.io/app/agents" -ForegroundColor White
Write-Host "  2. Click 'Create Agent'" -ForegroundColor White
Write-Host "  3. Name: JobAI Voice Agent" -ForegroundColor White
Write-Host "  4. First message: Hello! I am your JobAI voice assistant. How can I help with your job search today?" -ForegroundColor White
Write-Host "  5. LLM -> Custom -> URL: $supabaseUrl/functions/v1/voice-agent-llm" -ForegroundColor White
Write-Host "  6. Voice: Pick any (Rachel, Adam, etc.)" -ForegroundColor White
Write-Host "  7. Copy the Agent ID (agent_xxxxxxxxxxxxxxxx)" -ForegroundColor White
Write-Host ""

$agentId = Read-Host "Paste your ElevenLabs Agent ID here"

if ($agentId -match "^agent_") {
    # Update .env file
    $content = Get-Content $envPath -Raw
    if ($content -match 'VITE_ELEVENLABS_AGENT_ID=') {
        $content = $content -replace 'VITE_ELEVENLABS_AGENT_ID="?[^"`r`n]*"?', "VITE_ELEVENLABS_AGENT_ID=`"$agentId`""
    } else {
        $content = $content.TrimEnd() + "`r`nVITE_ELEVENLABS_AGENT_ID=`"$agentId`"`r`n"
    }
    Set-Content $envPath $content
    Write-Host "Agent ID saved to .env!" -ForegroundColor Green
} else {
    Write-Host "Invalid Agent ID format. Expected: agent_xxxxxxxxxxxxxxxx" -ForegroundColor Red
    exit 1
}

# Step 4: Done
Write-Host "[4/4] Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Run 'npm run dev' and go to /dashboard/voice-agent to test!" -ForegroundColor Cyan
