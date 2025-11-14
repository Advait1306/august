# Voice Input Setup Guide

This guide explains how to set up and use the voice input feature for the tasks page.

## Overview

The voice input feature allows users to record audio and have it transcribed into text using OpenAI's Whisper API. The audio is captured in the browser and sent to the backend server, which forwards it to OpenAI's Whisper API for transcription.

## Architecture

```
User clicks mic button
    ↓
Browser captures audio (Web Audio API)
    ↓
Audio sent to /api/transcribe endpoint
    ↓
Backend forwards to OpenAI Whisper API
    ↓
Transcription returned to frontend
    ↓
Text inserted into textarea
```

## Prerequisites

### 1. OpenAI API Key

You need an OpenAI API key to use the Whisper transcription service.

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API keys section
4. Create a new API key
5. Copy the API key

### 2. Environment Variable

Add the following environment variable to your server's environment:

**File: `apps/server/.env`**

```env
OPENAI_API_KEY=sk-your-api-key-here
```

**Important:** Make sure to add `.env` to your `.gitignore` file to avoid committing API keys to version control.

## Pricing

OpenAI Whisper API pricing (as of 2025):
- **$0.006 per minute** of audio transcribed
- Approximately **$0.36 per hour** of audio

For typical voice input usage (1-2 minute clips), costs are minimal.

## Usage

### For End Users

1. Navigate to the tasks page in the application
2. Look for the **microphone button** (🎤) in the input toolbar
3. Click the microphone button to start recording
4. Speak your message
5. Click the microphone button again (now showing 🎤❌ in red) to stop recording
6. Wait for processing (you'll see a loading spinner)
7. The transcribed text will automatically appear in the textarea

### Supported Audio Formats

The browser recorder uses:
- **WebM** (if supported by browser)
- **MP4** (fallback)

Both formats are supported by OpenAI's Whisper API.

### Browser Permissions

Users will need to grant microphone permissions when first using the feature. Modern browsers will prompt for permission automatically.

## Technical Details

### Backend Endpoint

**POST** `/api/transcribe`

**Authentication:** Required (Clerk Bearer token)

**Request:**
- Content-Type: `multipart/form-data`
- Body: `audio` file (WebM or MP4)
- Optional: `language` parameter for language hint

**Response:**
```json
{
  "text": "Transcribed text here"
}
```

### Frontend Component

**File:** `apps/app/components/voice-recorder.tsx`

The `VoiceRecorder` component handles:
- Browser microphone access
- Audio recording using MediaRecorder API
- Sending audio to backend
- Displaying recording/processing states
- Error handling

**File:** `apps/app/components/task-window.tsx`

The voice recorder is integrated into the `PromptInputTools` toolbar alongside other input tools.

### Dependencies

**Backend:**
- `openai` (^6.2.0) - OpenAI SDK
- `multer` - File upload handling

**Frontend:**
- `lucide-react` - Icons (Mic, MicOff, Loader2)
- `@clerk/clerk-react` - Authentication

## Troubleshooting

### Issue: "Failed to access microphone"

**Solution:**
- Check browser permissions for microphone access
- Ensure you're using HTTPS (required for microphone access in most browsers)
- Try a different browser

### Issue: "Failed to transcribe audio"

**Solution:**
- Check that `OPENAI_API_KEY` is set correctly in server environment
- Verify OpenAI API key is valid and has credits
- Check server logs for detailed error messages

### Issue: "User not authenticated"

**Solution:**
- Ensure user is logged in via Clerk
- Check that Clerk session is valid
- Verify authentication headers are being sent correctly

## Development

### Testing Locally

1. Set up environment variables:
   ```bash
   cd apps/server
   echo "OPENAI_API_KEY=sk-your-key" >> .env
   ```

2. Start the backend server:
   ```bash
   npm run dev
   ```

3. Start the frontend app:
   ```bash
   cd ../app
   npm run dev
   ```

4. Test the voice input feature on the tasks page

### Server Endpoint Location

**File:** `apps/server/src/controllers/proxy.controller.ts`

The `/api/transcribe` endpoint is defined in the proxy controller alongside other API endpoints.

## Security Considerations

1. **API Key Protection:** The OpenAI API key is only stored on the backend server and never exposed to the client
2. **Authentication:** All transcription requests require valid Clerk authentication
3. **Rate Limiting:** Consider implementing rate limiting to prevent abuse
4. **File Size Limits:** Multer is configured with memory storage; consider adding file size limits for production

## Future Enhancements

Potential improvements:
- [ ] Add language detection/selection UI
- [ ] Support for longer recordings with chunking
- [ ] Real-time transcription as user speaks
- [ ] Offline mode with local Whisper model (for users with GPUs)
- [ ] Audio visualization during recording
- [ ] Playback before submitting
