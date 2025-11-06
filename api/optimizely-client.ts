import axios from "axios";
import type {
  OptimizelyProject,
  OptimizelyExperiment,
  OptimizelyAudience,
  OptimizelyPage,
  OptimizelyEvent,
  OptimizelyExperimentResults,
  OptimizelyAPIError,
} from "./optimizely-types";

/**
 * Rate limiter for Optimizely API requests
 * Based on Optimizely's documented limits: 60 requests per minute
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number = 60;
  private readonly windowMs: number = 60000; // 1 minute

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Remove requests older than 1 minute
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer

      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Recursively check again after waiting
      return this.waitIfNeeded();
    }

    this.requests.push(now);
  }
}

/**
 * Custom error class for Optimizely API errors
 */
export class OptimizelyClientError extends Error implements OptimizelyAPIError {
  status?: number;
  code?: string;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = "OptimizelyClientError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, OptimizelyClientError.prototype);
  }
}

/**
 * Optimizely Web Experimentation API Client
 * Handles authentication, rate limiting, and error handling for API requests
 */
export class OptimizelyClient {
  private client: any;
  private rateLimiter: RateLimiter;
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
    this.rateLimiter = new RateLimiter();

    this.client = axios.create({
      baseURL: "https://api.optimizely.com/v2",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): OptimizelyClientError {
    if (error.response) {
      const { status, data, statusText, headers } = error.response;
      const message = (data as any)?.message || `HTTP ${status} error`;
      const code = (data as any)?.code || `HTTP_${status}`;

      // Enhanced logging for debugging
      console.log("DEBUG: Optimizely API Error Details:", {
        status,
        statusText,
        data: JSON.stringify(data, null, 2),
        headers: {
          "x-request-id": headers["x-request-id"],
          "content-type": headers["content-type"],
          server: headers["server"],
        },
      });

      return new OptimizelyClientError(
        `Optimizely API Error: ${message}`,
        status,
        code,
        data
      );
    } else if (error.request) {
      console.log("DEBUG: Network error details:", {
        message: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
      });
      return new OptimizelyClientError(
        "Network error: Unable to reach Optimizely API",
        undefined,
        "NETWORK_ERROR",
        error.message
      );
    } else {
      console.log("DEBUG: Request setup error:", error.message);
      return new OptimizelyClientError(
        `Request error: ${error.message}`,
        undefined,
        "REQUEST_ERROR",
        error.message
      );
    }
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    data?: any
  ): Promise<T> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const response = await this.client.request({
        method,
        url,
        data,
      });
      return response.data;
    } catch (error) {
      console.error(`Optimizely API ${method} ${url} failed:`, error);
      throw error;
    }
  }

  // Project methods
  async getProject(projectId: string): Promise<OptimizelyProject> {
    return this.makeRequest<OptimizelyProject>("GET", `/projects/${projectId}`);
  }

  // Experiment methods
  async listExperiments(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
      archived?: boolean;
    } = {}
  ): Promise<OptimizelyExperiment[]> {
    const params = new URLSearchParams();
    // Add project_id as a filter parameter
    params.append("project_id", projectId);
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());

    // Only add include_classic if it's explicitly set (not undefined)
    if (options.include_classic !== undefined) {
      params.append("include_classic", options.include_classic.toString());
      console.log(`DEBUG: Adding include_classic=${options.include_classic}`);
    } else {
      console.log(`DEBUG: Not adding include_classic parameter (undefined)`);
    }

    const url = `/experiments?${params.toString()}`;
    console.log(`DEBUG: Making request to: ${url}`);
    console.log(`DEBUG: Project ID: ${projectId}, Type: ${typeof projectId}`);
    console.log(`DEBUG: Full URL params: ${params.toString()}`);

    return this.makeRequest<OptimizelyExperiment[]>("GET", url);
  }

  async getExperiment(
    projectId: string,
    experimentId: string
  ): Promise<OptimizelyExperiment> {
    const url = `/experiments/${experimentId}`;
    console.log(`DEBUG: Getting experiment with URL: ${url}`);
    console.log(
      `DEBUG: Experiment ID: ${experimentId}, Type: ${typeof experimentId}, Length: ${
        experimentId.length
      }`
    );

    return this.makeRequest<OptimizelyExperiment>("GET", url);
  }

  async createExperiment(
    projectId: string,
    experimentData: any
  ): Promise<OptimizelyExperiment> {
    // Add project_id to the experiment data
    const dataWithProjectId = {
      ...experimentData,
      project_id: parseInt(projectId, 10), // Ensure base 10 parsing
    };

    console.log(
      "DEBUG: Final payload with project_id:",
      JSON.stringify(dataWithProjectId, null, 2)
    );
    return this.makeRequest<OptimizelyExperiment>(
      "POST",
      `/experiments`,
      dataWithProjectId
    );
  }

  async getExperimentResults(
    projectId: string,
    experimentId: string
  ): Promise<OptimizelyExperimentResults> {
    return this.makeRequest<OptimizelyExperimentResults>(
      "GET",
      `/experiments/${experimentId}/results`
    );
  }

  // Audience methods
  async listAudiences(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
    } = {}
  ): Promise<OptimizelyAudience[]> {
    const params = new URLSearchParams();
    // Add project_id as a filter parameter (like experiments)
    params.append("project_id", projectId);
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    // Remove include_classic parameter as it's likely causing issues

    const url = `/audiences?${params.toString()}`;
    console.log(`DEBUG: Making audiences request to: ${url}`);
    return this.makeRequest<OptimizelyAudience[]>("GET", url);
  }

  async getAudience(
    projectId: string,
    audienceId: string
  ): Promise<OptimizelyAudience> {
    const url = `/audiences/${audienceId}`;
    console.log(`DEBUG: Getting audience with URL: ${url}`);
    console.log(
      `DEBUG: Audience ID: ${audienceId}, Type: ${typeof audienceId}, Length: ${
        audienceId.length
      }`
    );

    return this.makeRequest<OptimizelyAudience>("GET", url);
  }

  // Page methods
  async listPages(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
    } = {}
  ): Promise<OptimizelyPage[]> {
    const params = new URLSearchParams();
    // Add project_id as a filter parameter (like experiments)
    params.append("project_id", projectId);
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    // Remove include_classic parameter as it's likely causing issues

    const url = `/pages?${params.toString()}`;
    console.log(`DEBUG: Making pages request to: ${url}`);
    return this.makeRequest<OptimizelyPage[]>("GET", url);
  }

  async getPage(projectId: string, pageId: string): Promise<OptimizelyPage> {
    const url = `/pages/${pageId}`;
    console.log(`DEBUG: Getting page with URL: ${url}`);
    console.log(
      `DEBUG: Page ID: ${pageId}, Type: ${typeof pageId}, Length: ${
        pageId.length
      }`
    );

    return this.makeRequest<OptimizelyPage>("GET", url);
  }

  // Event methods
  async listEvents(
    projectId: string,
    options: {
      page?: number;
      per_page?: number;
      include_classic?: boolean;
    } = {}
  ): Promise<OptimizelyEvent[]> {
    const params = new URLSearchParams();
    // Add project_id as a filter parameter (like experiments)
    params.append("project_id", projectId);
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    // Remove include_classic parameter as it's likely causing issues

    const url = `/events?${params.toString()}`;
    console.log(`DEBUG: Making events request to: ${url}`);
    return this.makeRequest<OptimizelyEvent[]>("GET", url);
  }

  async getEvent(projectId: string, eventId: string): Promise<OptimizelyEvent> {
    const url = `/events/${eventId}`;
    console.log(`DEBUG: Getting event with URL: ${url}`);
    console.log(
      `DEBUG: Event ID: ${eventId}, Type: ${typeof eventId}, Length: ${
        eventId.length
      }`
    );

    return this.makeRequest<OptimizelyEvent>("GET", url);
  }

  // Search methods
  async search(
    projectId: string | undefined,
    query: string | undefined,
    options: {
      type?: string;
      page?: number;
      per_page?: number;
      archived?: boolean;
    } = {}
  ): Promise<any[]> {
    const params = new URLSearchParams();
    // Only append project_id if provided (allows searching across all projects)
    if (projectId) {
      params.append("project_id", projectId);
    }
    // Always append query parameter, even if empty (blank query returns all results)
    params.append("query", query || "");
    if (options.type) params.append("type", options.type);
    if (options.page) params.append("page", options.page.toString());
    if (options.per_page)
      params.append("per_page", options.per_page.toString());
    // Add archived parameter if specified
    if (options.archived !== undefined) {
      params.append("archived", options.archived.toString());
    }

    const url = `/search?${params.toString()}`;
    console.log(`DEBUG: Making search request to: ${url}`);
    return this.makeRequest<any[]>("GET", url);
  }

  // Utility methods
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      // Simple health check by making a minimal API call
      await this.makeRequest("GET", "/projects?per_page=1");
      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Create a singleton instance for use across the application
let optimizelyClient: OptimizelyClient | null = null;

export function getOptimizelyClient(): OptimizelyClient {
  if (!optimizelyClient) {
    const apiToken = process.env.OPTIMIZELY_API_TOKEN;
    if (!apiToken) {
      throw new Error("OPTIMIZELY_API_TOKEN environment variable is required");
    }
    optimizelyClient = new OptimizelyClient(apiToken);
  }
  return optimizelyClient;
}

// OptimizelyClient is already exported above
