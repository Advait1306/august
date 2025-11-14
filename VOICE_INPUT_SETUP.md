# Voice Input Setup Guide

This guide explains how to set up and use the voice input feature for the tasks page.

## Overview

The voice input feature allows users to record audio and have it **transcribed in real-time** as they speak using OpenAI's Realtime API with WebSocket streaming. This provides a much more responsive experience compared to batch transcription.

## Architecture

```
User clicks mic button
    ↓
Browser captures audio (Web Audio API)
    ↓
Audio converted to PCM16 @ 24kHz in browser
    ↓
Audio streamed via WebSocket to backend
    ↓
Backend proxies to OpenAI Realtime API
    ↓
Real-time transcription events streamed back
    ↓
Text appears in textarea as user speaks
```

### Key Features

- ✅ **Real-time streaming**: See transcription appear as you speak
- ✅ **Low latency**: Minimal delay between speech and text
- ✅ **Audio processing**: Automatic resampling to 24kHz PCM16
- ✅ **Speech detection**: Automatic detection of speech start/stop
- ✅ **Secure**: API key never exposed to client

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

OpenAI Realtime API pricing (as of 2025):
- **Text input/output**: Billed per token (similar to GPT-4o)
- **Audio input**: Billed per token at audio-specific rates
- **Real-time transcription models**: `gpt-4o-mini-transcribe` and `gpt-4o-transcribe`

For typical voice input usage (1-2 minute clips), costs are minimal. The streaming nature means you only pay for the audio actually processed.

## Usage

### For End Users

1. Navigate to the tasks page in the application
2. Look for the **microphone button** (🎤) in the input toolbar
3. Click the microphone button to start recording
4. Speak your message
5. Click the microphone button again (now showing 🎤❌ in red) to stop recording
6. Wait for processing (you'll see a loading spinner)
7. The transcribed text will automatically appear in the textarea

### Audio Format

The implementation uses:
- **Format**: 16-bit PCM (raw audio)
- **Sample Rate**: 24000 Hz (24 kHz)
- **Channels**: 1 (mono)
- **Encoding**: Little-endian
- **Transmission**: Base64-encoded over WebSocket

Audio is captured from the browser microphone and automatically:
1. Converted from Float32 to Int16 (PCM16)
2. Resampled to 24kHz if necessary
3. Encoded to base64
4. Streamed to the backend in real-time

### Browser Permissions

Users will need to grant microphone permissions when first using the feature. Modern browsers will prompt for permission automatically.

## Technical Details

### Backend WebSocket Endpoint

**WebSocket** `ws://localhost:8080/api/realtime`

**Authentication:** Required (Clerk token via query parameter)

**Connection URL:**
```
ws://localhost:8080/api/realtime?token=<clerk-bearer-token>
```

**Message Format (Client → Server):**
```json
{
  "type": "input_audio_buffer.append",
  "audio": "<base64-encoded-pcm16-audio>"
}
```

**Message Format (Server → Client):**
```json
{
  "type": "conversation.item.input_audio_transcription.completed",
  "transcript": "Transcribed text here"
}
```

**Other Events:**
- `input_audio_buffer.speech_started` - Speech detected
- `input_audio_buffer.speech_stopped` - Speech ended
- `error` - Transcription error occurred

### Frontend Component

**File:** `apps/app/components/voice-recorder.tsx`

The `VoiceRecorder` component handles:
- Browser microphone access with optimized audio constraints
- Real-time audio processing using Web Audio API
- Float32 to PCM16 audio conversion
- Audio resampling to 24kHz
- WebSocket connection management
- Real-time transcription event handling
- Visual feedback (pulsing red mic during recording)
- Proper cleanup on unmount

**File:** `apps/app/components/task-window.tsx`

The voice recorder is integrated into the `PromptInputTools` toolbar alongside other input tools.

### Dependencies

**Backend:**
- `ws` (^8.18.3) - WebSocket server
- `@types/ws` (^8.18.1) - TypeScript types for ws
- Native Node.js `http` server for WebSocket upgrade handling

**Frontend:**
- `lucide-react` - Icons (Mic, MicOff)
- `@clerk/clerk-react` - Authentication
- Native browser WebSocket API
- Web Audio API (AudioContext, ScriptProcessorNode)

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

### Server Implementation

**WebSocket Controller:** `apps/server/src/controllers/realtime.controller.ts`

The WebSocket server:
- Handles connection upgrades on `/api/realtime` path
- Validates Clerk authentication tokens
- Establishes bidirectional proxy to OpenAI's Realtime API
- Forwards audio data from client to OpenAI
- Streams transcription events from OpenAI back to client
- Manages connection lifecycle and cleanup

**Main Server:** `apps/server/src/index.ts`

The WebSocket server is attached to the Express HTTP server, allowing both REST and WebSocket endpoints to coexist.

## Security Considerations

1. **API Key Protection:** The OpenAI API key is only stored on the backend server and never exposed to the client
2. **Authentication:** All WebSocket connections require valid Clerk authentication token
3. **Connection Limits:** OpenAI Realtime API sessions are limited to 30 minutes maximum
4. **Token Validation:** In production, implement proper Clerk token validation on the backend before allowing WebSocket upgrade
5. **Rate Limiting:** Consider implementing rate limiting to prevent abuse of WebSocket connections

## Future Enhancements

Potential improvements:
- [ ] Add language detection/selection UI
- [ ] Visual audio level indicator during recording
- [ ] Support for punctuation commands ("period", "comma", etc.)
- [ ] Offline mode with local Whisper model (for users with GPUs)
- [ ] Audio visualization waveform during recording
- [ ] Session reconnection on temporary network issues
- [ ] Support for voice commands to control the textarea

## Performance Notes

- **Latency**: Transcription typically appears within 1-2 seconds of speaking
- **Browser Compatibility**: Requires browsers supporting WebSocket and Web Audio API (all modern browsers)
- **Sample Rate**: Browser audio is automatically resampled to 24kHz if needed
- **Buffer Size**: Uses 4096-sample buffers for optimal balance between latency and performance
