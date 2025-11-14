import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { parse } from "url";

/**
 * Creates a WebSocket server for OpenAI Realtime API proxy
 * Handles authentication and bidirectional audio streaming
 */
export function createRealtimeWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const { pathname, query } = parse(request.url || "", true);

    if (pathname === "/api/realtime") {
      // Extract auth token from query or headers
      const token =
        (query.token as string) || request.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      // Verify token with Clerk (we'll pass it through for now)
      // In production, you'd verify the Clerk session here

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, token);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle WebSocket connections
  wss.on("connection", (clientWs: WebSocket, request: IncomingMessage, token: string) => {
    console.log("[Realtime] Client connected");

    // Connect to OpenAI Realtime API
    const openaiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-transcribe",
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    // OpenAI connection opened
    openaiWs.on("open", () => {
      console.log("[Realtime] Connected to OpenAI");

      // Send session configuration
      openaiWs.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text"],
            input_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1",
            },
          },
        })
      );
    });

    // Forward messages from client to OpenAI
    clientWs.on("message", (data: Buffer) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(data);
      }
    });

    // Forward messages from OpenAI to client
    openaiWs.on("message", (data: Buffer) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    // Handle OpenAI errors
    openaiWs.on("error", (error) => {
      console.error("[Realtime] OpenAI WebSocket error:", error);
      clientWs.send(
        JSON.stringify({
          type: "error",
          error: { message: "OpenAI connection error" },
        })
      );
    });

    // Handle OpenAI close
    openaiWs.on("close", () => {
      console.log("[Realtime] OpenAI connection closed");
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    // Handle client close
    clientWs.on("close", () => {
      console.log("[Realtime] Client disconnected");
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });

    // Handle client errors
    clientWs.on("error", (error) => {
      console.error("[Realtime] Client WebSocket error:", error);
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });
  });

  return wss;
}
