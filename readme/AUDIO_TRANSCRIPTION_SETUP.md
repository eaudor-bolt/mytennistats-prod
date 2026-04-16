# Audio Transcription Setup Guide

This guide explains how to set up the audio transcription feature for the Tennis Rules chatbot.

## Overview

The audio transcription feature allows users to ask questions about tennis rules using their voice. The system:
1. Records audio from the user's microphone
2. Transcribes the audio to text using Groq's Whisper API (free!)
3. Sends the transcribed text to Mistral AI for processing
4. Returns the answer in the same language (French or English)

## Prerequisites

You need a Groq API key to use the Whisper API for audio transcription. Groq offers a generous **free tier** with fast inference.

> **Note:** Groq is NOT related to Grok (Elon Musk's xAI). Groq is an independent hardware company that provides ultra-fast AI inference.

## Setup Instructions

### 1. Get a Groq API Key (Free!)

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up for a free account
3. Navigate to [API Keys](https://console.groq.com/keys)
4. Click "Create API Key"
5. Give it a name and copy the API key (you won't be able to see it again)

### 2. Add the API Key to Supabase

You need to add the Groq API key as a secret to your Supabase project:

#### Using Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Scroll down to **Secrets**
4. Add a new secret:
   - **Name:** `GROQ_API_KEY`
   - **Value:** Your Groq API key

#### Using Supabase CLI (if you have it installed):
```bash
supabase secrets set GROQ_API_KEY=your_groq_api_key_here
```

### 3. Verify the Setup

After adding the API key:
1. Go to the Rules page in your tennis app
2. Click the microphone icon
3. Allow microphone permissions if prompted
4. Speak your question in French or English
5. Click the red microphone button again to stop recording
6. The audio will be automatically transcribed and sent to the AI

## Supported Languages

The Whisper API automatically detects the language. The system is optimized for:
- **French** (fr)
- **English** (en)

But Whisper supports many other languages as well.

## Features

- **Auto Language Detection:** The system automatically detects whether you're speaking in French or English
- **High-Quality Transcription:** Uses Groq's Whisper Large v3 model for accurate speech-to-text conversion
- **Ultra-Fast:** Groq's hardware provides extremely fast transcription (often under 1 second)
- **Free Tier:** Generous free tier with no credit card required
- **Noise Suppression:** Applies echo cancellation and noise suppression for better audio quality
- **Real-time Feedback:** Shows transcription progress with visual indicators

## Troubleshooting

### "Groq API key not configured" Error
- Make sure you added the `GROQ_API_KEY` secret to Supabase
- Verify the secret name is exactly `GROQ_API_KEY` (case-sensitive)
- Redeploy the edge function after adding the secret

### Microphone Permission Denied
- Grant microphone permissions in your browser settings
- On Chrome: Click the lock icon in the address bar → Site settings → Allow microphone
- On mobile: Check app permissions in your device settings

### "No speech detected" Error
- Speak louder and closer to the microphone
- Check that your microphone is working properly
- Make sure there's minimal background noise

### Audio Recording Not Starting
- Try using a different browser (Chrome, Firefox, or Safari work best)
- Check browser console for specific error messages
- Ensure you're using HTTPS (required for microphone access)

## Cost Considerations

Groq offers a **FREE tier** that includes:
- 14,400 requests per day
- 7,200 requests per minute
- More than enough for personal projects and small apps

**No credit card required for the free tier!**

If you exceed the free tier limits, paid plans are available at very competitive rates.

## Technical Details

### Edge Function
- **Name:** `transcribe-audio`
- **Location:** `/supabase/functions/transcribe-audio/index.ts`
- **Model:** Whisper Large v3 (via Groq)
- **Speed:** Ultra-fast inference (typically < 1 second)

### Audio Format
The system automatically selects the best supported audio format:
1. `audio/webm;codecs=opus` (preferred)
2. `audio/webm`
3. `audio/ogg;codecs=opus`
4. `audio/mp4` (fallback)

### Audio Settings
- Sample Rate: 44.1 kHz
- Echo Cancellation: Enabled
- Noise Suppression: Enabled

## Security

- The Groq API key is stored securely in Supabase secrets
- It's never exposed to the client-side code
- All API calls go through your Supabase edge functions
- JWT authentication is required to use the transcription endpoint

## Why Groq?

Groq offers several advantages:
- **Free tier:** No credit card required, generous limits
- **Ultra-fast:** Hardware-accelerated inference for near-instant transcription
- **High quality:** Uses the latest Whisper Large v3 model
- **Independent:** Not affiliated with OpenAI or Elon Musk's companies
- **Simple API:** OpenAI-compatible API makes migration easy
