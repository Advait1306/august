import { Response, Request } from "express";
import { BillingService, UsageData } from "./billing.service";
import { OAuthService } from "./oauth.service";

export class ProxyService {
  constructor(
    private billingService: BillingService,
    private oauthService?: OAuthService
  ) {}

  /**
   * Forward request to Anthropic API and handle streaming response
   */
  async forwardToAnthropic(
    body: unknown,
    anthropicVersion: string,
    res: Response,
    orgId: string
  ) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": anthropicVersion || "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status);

    // Handle streaming response
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamedData += chunk;
        res.write(chunk);
      }

      res.end();

      // Parse usage data from streamed response
      await this.parseAndDeductUsage(streamedData, orgId);
    } else {
      // NOTE: Dead code, never seems to run
      const data = await response.json();

      // Create consolidated usage object for non-streaming response
      if (data.usage) {
        console.log("=== Anthropic Usage Data (Non-Streaming) ===");
        console.log(
          JSON.stringify(
            {
              orgId,
              model: data.model,
              usage: data.usage,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );

        // Deduct usage cost
        if (data.model && data.usage && data.id) {
          await this.billingService.deductUsage(orgId, data.model, data.usage);
        }
      }

      res.json(data);
    }
  }

  /**
   * Parse streaming response and deduct usage cost
   */
  private async parseAndDeductUsage(streamedData: string, orgId: string) {
    // Try to parse as a complete message object first (non-SSE format)
    try {
      const completeMessage = JSON.parse(streamedData);
      if (completeMessage.type === "message" && completeMessage.usage) {
        const usageLog = {
          orgId,
          model: completeMessage.model,
          usage: completeMessage.usage,
          timestamp: new Date().toISOString(),
        };

        console.log("=== Anthropic Usage Data (Initial Message) ===");
        console.log(JSON.stringify(usageLog, null, 2));

        // Deduct usage cost
        await this.billingService.deductUsage(
          orgId,
          completeMessage.model,
          completeMessage.usage
        );

        return;
      }
    } catch {
      // Not a complete JSON message, continue to parse as SSE
    }

    // Extract model name and usage data from message_start event
    const messageStartMatch = streamedData.match(
      /event:\s*message_start\s*\ndata:\s*({.*?})\s*\n/s
    );
    if (messageStartMatch) {
      try {
        const messageStartData = JSON.parse(messageStartMatch[1]);
        const model = messageStartData.message?.model;
        const messageId = messageStartData.message?.id;
        let usage = messageStartData.message?.usage;

        // Extract final usage data from message_delta event (has complete output_tokens)
        const messageDeltaMatch = streamedData.match(
          /event:\s*message_delta\s*\ndata:\s*({.*?})\s*\n/s
        );
        if (messageDeltaMatch) {
          const messageDeltaData = JSON.parse(messageDeltaMatch[1]);
          if (messageDeltaData.usage) {
            usage = messageDeltaData.usage;
          }
        }

        // Create consolidated usage object
        const usageLog = {
          orgId,
          model,
          usage,
          timestamp: new Date().toISOString(),
        };

        console.log("=== Anthropic Usage Data ===");
        console.log(JSON.stringify(usageLog, null, 2));

        // Deduct usage cost
        if (model && usage && messageId) {
          await this.billingService.deductUsage(orgId, model, usage as UsageData);
        }
      } catch (e) {
        console.error("Failed to parse streaming events:", e);
      }
    }
  }

  /**
   * Forward request to MCP server with OAuth token replacement
   */
  async forwardToMCP(
    mcpServerUrl: string,
    accessToken: string,
    req: Request,
    res: Response,
    path: string
  ) {
    try {
      // Construct the full URL to the MCP server
      const targetUrl = new URL(path, mcpServerUrl);

      console.log("[MCP Proxy Service] Forwarding request:", {
        mcpServerUrl,
        path,
        targetUrl: targetUrl.toString(),
        method: req.method,
      });

      // Prepare headers, excluding the original Authorization header
      const headers: Record<string, string> = {};

      // Copy relevant headers from the original request
      Object.keys(req.headers).forEach((key) => {
        const value = req.headers[key];
        // Skip host, authorization, and connection headers
        if (
          key.toLowerCase() !== "host" &&
          key.toLowerCase() !== "authorization" &&
          key.toLowerCase() !== "connection" &&
          value
        ) {
          headers[key] = Array.isArray(value) ? value[0] : value;
        }
      });

      // Add the OAuth access token
      headers["authorization"] = `Bearer ${accessToken}`;

      // Forward the request
      console.log("[MCP Proxy Service] Making request with headers:", {
        ...headers,
        authorization: "Bearer [REDACTED]",
      });

      const response = await fetch(targetUrl.toString(), {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
      });

      console.log("[MCP Proxy Service] Response received:", {
        status: response.status,
        statusText: response.statusText,
      });

      // Copy response headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      res.status(response.status);

      // Handle streaming or regular response
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }

        res.end();
      } else {
        const data = await response.text();
        res.send(data);
      }
    } catch (error) {
      console.error("[MCP Proxy] Error forwarding request:", error);
      throw error;
    }
  }
}
