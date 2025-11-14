"use client";

import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { getToken } = useAuth();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // Convert Float32 audio to PCM16
  const floatTo16BitPCM = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  };

  // Resample audio from source sample rate to 24kHz
  const resampleTo24kHz = (
    audioData: Float32Array,
    sourceSampleRate: number
  ): Float32Array => {
    if (sourceSampleRate === 24000) return audioData;

    const ratio = sourceSampleRate / 24000;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < audioData.length) {
        result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        result[i] = audioData[index];
      }
    }

    return result;
  };

  const startRecording = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        alert("Not authenticated. Please log in.");
        return;
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Create WebSocket connection
      const ws = new WebSocket(
        `ws://localhost:8080/api/realtime?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[VoiceRecorder] WebSocket connected");
        setIsRecording(true);

        // Setup audio processing
        const audioContext = new AudioContext({ sampleRate: 24000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);

            // Resample if necessary
            const resampled = resampleTo24kHz(inputData, audioContext.sampleRate);

            // Convert to PCM16
            const pcm16 = floatTo16BitPCM(resampled);

            // Convert to base64 and send
            const base64Audio = btoa(
              String.fromCharCode(...new Uint8Array(pcm16.buffer))
            );

            ws.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64Audio,
              })
            );
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle transcription events
          if (message.type === "conversation.item.input_audio_transcription.completed") {
            const transcript = message.transcript;
            if (transcript) {
              onTranscription(transcript);
            }
          } else if (message.type === "input_audio_buffer.speech_started") {
            console.log("[VoiceRecorder] Speech detected");
          } else if (message.type === "input_audio_buffer.speech_stopped") {
            console.log("[VoiceRecorder] Speech ended");
          } else if (message.type === "error") {
            console.error("[VoiceRecorder] Error:", message.error);
            alert(`Transcription error: ${message.error.message}`);
          }
        } catch (error) {
          console.error("[VoiceRecorder] Failed to parse message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[VoiceRecorder] WebSocket error:", error);
        alert("Connection error. Please try again.");
        stopRecording();
      };

      ws.onclose = () => {
        console.log("[VoiceRecorder] WebSocket closed");
        setIsRecording(false);
      };
    } catch (error) {
      console.error("[VoiceRecorder] Error starting recording:", error);
      alert("Failed to access microphone. Please check your permissions.");
      setIsRecording(false);
    }
  }, [getToken, onTranscription]);

  const stopRecording = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        // Commit the audio buffer before closing
        wsRef.current.send(
          JSON.stringify({
            type: "input_audio_buffer.commit",
          })
        );
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-md"
      onClick={handleClick}
      disabled={disabled}
      title={isRecording ? "Stop recording" : "Start voice input"}
    >
      {isRecording ? (
        <MicOff className="h-4 w-4 text-red-500 animate-pulse" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
