import { createServer } from "../../app.js";
import { FastifyInstance } from "fastify";

export type ApiResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  text: string;
};

export class ApiClient {
  private server: FastifyInstance;

  constructor() {
    this.server = null as unknown as FastifyInstance;
  }

  async setup() {
    if (!this.server) {
      this.server = await createServer({
        logger: process.env.VITEST_DEBUG_LOGS ? { level: "info" } : undefined,
      });
      // Ensure all plugins/routes are fully registered before handling requests.
      await this.server.ready();
    }
    return this.server;
  }

  async teardown() {
    if (this.server) {
      await this.server.close();
      this.server = null as unknown as FastifyInstance;
    }
  }

  private getServer() {
    if (!this.server) {
      throw new Error("API client not initialized. Call setup() first.");
    }
    return this.server;
  }

  private async inject(
    method: string,
    url: string,
    options: {
      token?: string;
      data?: any;
      headers?: Record<string, string>;
      files?: Array<{ field: string; buffer: Buffer; filename: string }>;
    } = {}
  ): Promise<ApiResponse> {
    if (options.files && options.files.length > 0) {
      throw new Error("Multipart file uploads are not supported by the test ApiClient.");
    }

    const headers: Record<string, string> = {};
    if (options.token) headers["authorization"] = `Bearer ${options.token}`;
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers[key.toLowerCase()] = value;
      }
    }

    let payload: string | undefined;
    if (options.data !== undefined) {
      if (typeof options.data === "string") {
        payload = options.data;
      } else {
        payload = JSON.stringify(options.data);
        headers["content-type"] = headers["content-type"] || "application/json";
      }
    }

    const res = await this.getServer().inject({
      method,
      url,
      payload,
      headers,
    });

    const text = res.payload ?? "";
    const contentType = String(res.headers["content-type"] || "");
    let body: any = text;
    if (contentType.includes("application/json")) {
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = text;
      }
    }

    return {
      status: res.statusCode,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body,
      text,
    };
  }

  // Authentication endpoints
  async register(data: { email: string; password: string }) {
    return this.inject("POST", "/api/auth/register", { data });
  }

  async login(data: { email: string; password: string }) {
    return this.inject("POST", "/api/auth/login", { data });
  }

  async refreshToken(refreshToken: string) {
    return this.inject("POST", "/api/auth/refresh", { data: { refreshToken } });
  }

  async logout(refreshToken: string) {
    return this.inject("POST", "/api/auth/logout", { data: { refreshToken } });
  }

  // User profile endpoints
  async getProfile(token: string) {
    return this.inject("GET", "/api/profile", { token });
  }

  async updateProfile(token: string, data: any) {
    return this.inject("PUT", "/api/profile", { token, data });
  }

  // Lab reports endpoints
  async getLabReports(token: string) {
    return this.inject("GET", "/api/labs", { token });
  }

  async getLabReport(token: string, reportId: string) {
    return this.inject("GET", `/api/labs/${reportId}`, { token });
  }

  async deleteLabReport(token: string, reportId: string) {
    return this.inject("DELETE", `/api/labs/${reportId}`, { token });
  }

  async createLabReport(token: string, data: { filename: string; s3Key: string; reportDate?: string; notes?: string }) {
    return this.inject("POST", "/api/labs", { token, data });
  }

  // Daily logs endpoints
  async getDailyLogs(token: string, query?: Record<string, string>) {
    const params = new URLSearchParams(query || {});
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.inject("GET", `/api/logs${suffix}`, { token });
  }

  async createDailyLog(token: string, data: any) {
    return this.inject("POST", "/api/logs", { token, data });
  }

  async getDailyLogByDate(token: string, dateIso: string) {
    return this.inject("GET", `/api/logs/${encodeURIComponent(dateIso)}`, { token });
  }

  // Dashboard endpoints
  async getDashboard(token: string) {
    return this.inject("GET", "/api/dashboard", { token });
  }

  async calculateDashboardScore(token: string) {
    return this.inject("POST", "/api/dashboard/calculate", { token });
  }

  // Generic methods for testing
  async makeRequest(
    method: string,
    path: string,
    options: {
      token?: string;
      data?: any;
      headers?: Record<string, string>;
      files?: Array<{ field: string; buffer: Buffer; filename: string }>;
    } = {}
  ) {
    return this.inject(method.toUpperCase(), path, options);
  }
}

export const createApiClient = async () => {
  const client = new ApiClient();
  await client.setup();
  return client;
};

export default ApiClient;
