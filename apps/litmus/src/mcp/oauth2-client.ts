import http from "http";
import { randomBytes, createHash } from "crypto";
import open from "open";
import { CredentialStorage, StoredCredentials } from "./credential-storage.js";

interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  grant_types_supported?: string[];
  response_types_supported?: string[];
  code_challenge_methods_supported?: string[];
}

export class OAuth2Client {
  private credentialStorage: CredentialStorage;
  private redirectUri = "http://localhost:3000/callback";
  private callbackServer?: http.Server;
  private serverId: string;

  constructor(serverId: string) {
    this.credentialStorage = new CredentialStorage();
    this.serverId = serverId;
  }

  async discoverMetadata(mcpServerUrl: string): Promise<OAuthMetadata> {
    const metadataUrl = new URL(
      "/.well-known/oauth-authorization-server",
      mcpServerUrl
    );
    const response = await fetch(metadataUrl.toString());

    if (!response.ok) {
      throw new Error(
        `Failed to fetch OAuth metadata: ${response.statusText}`
      );
    }

    return await response.json();
  }

  async registerClient(registrationEndpoint: string): Promise<Record<string, unknown>> {
    const registrationRequest = {
      client_name: "Litmus MCP Client",
      redirect_uris: [this.redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
    };

    const response = await fetch(registrationEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registrationRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Client registration failed: ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  private generatePKCE() {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    return {
      codeVerifier: verifier,
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
    };
  }

  async authorize(
    authorizationEndpoint: string,
    tokenEndpoint: string,
    clientId: string,
    clientSecret?: string
  ): Promise<StoredCredentials> {
    const pkce = this.generatePKCE();
    const state = randomBytes(16).toString("hex");

    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", this.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", pkce.codeChallenge);
    authUrl.searchParams.set("code_challenge_method", pkce.codeChallengeMethod);

    console.log("\n Opening browser for authorization...");
    console.log("If the browser does not open, visit this URL:");
    console.log(authUrl.toString());
    console.log("");

    const authCode = await this.startCallbackServer(state, authUrl.toString());

    const tokenResponse = await this.exchangeCodeForToken(
      tokenEndpoint,
      authCode,
      clientId,
      clientSecret,
      pkce.codeVerifier
    );

    const expiresAt = tokenResponse.expires_in
      ? Date.now() + tokenResponse.expires_in * 1000
      : undefined;

    const credentials: StoredCredentials = {
      clientId,
      clientSecret,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenType: tokenResponse.token_type,
      expiresAt,
    };

    await this.credentialStorage.saveCredentials(this.serverId, credentials);

    return credentials;
  }

  private async startCallbackServer(
    expectedState: string,
    authUrl: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.callbackServer = http.createServer((req, res) => {
        const url = new URL(req.url || "", `http://${req.headers.host}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            `<h1>Authorization failed</h1><p>${error}: ${errorDescription}</p>`
          );
          this.callbackServer?.close();
          reject(
            new Error(`Authorization failed: ${error} - ${errorDescription}`)
          );
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Invalid state parameter</h1>");
          this.callbackServer?.close();
          reject(new Error("State parameter mismatch"));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Missing authorization code</h1>");
          this.callbackServer?.close();
          reject(new Error("Missing authorization code"));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Authorization successful!</h1><p>You can close this window and return to the terminal.</p>"
        );

        setTimeout(() => {
          this.callbackServer?.close();
        }, 1000);

        resolve(code);
      });

      this.callbackServer.listen(3000, () => {
        console.log("Callback server started on http://localhost:3000");
      });

      open(authUrl).catch((err) => {
        console.error("Failed to open browser:", err);
      });
    });
  }

  private async exchangeCodeForToken(
    tokenEndpoint: string,
    code: string,
    clientId: string,
    clientSecret?: string,
    codeVerifier?: string
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
  }> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      client_id: clientId,
    });

    if (codeVerifier) {
      body.set("code_verifier", codeVerifier);
    }

    if (clientSecret) {
      body.set("client_secret", clientSecret);
    }

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token exchange failed: ${response.statusText} - ${errorText}`
      );
    }

    console.log("Access token obtained");
    return await response.json();
  }

  async refreshAccessToken(
    tokenEndpoint: string,
    refreshToken: string,
    clientId: string,
    clientSecret?: string
  ): Promise<StoredCredentials> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });

    if (clientSecret) {
      body.set("client_secret", clientSecret);
    }

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token refresh failed: ${response.statusText} - ${errorText}`
      );
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in?: number;
    };
    console.log("Access token refreshed");

    const expiresAt = tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined;

    const credentials: StoredCredentials = {
      clientId,
      clientSecret,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      tokenType: tokenData.token_type,
      expiresAt,
    };

    await this.credentialStorage.saveCredentials(this.serverId, credentials);

    return credentials;
  }

  async getStoredCredentials(): Promise<StoredCredentials | null> {
    return this.credentialStorage.loadCredentials(this.serverId);
  }

  async clearCredentials(): Promise<void> {
    return this.credentialStorage.clearCredentials(this.serverId);
  }
}
