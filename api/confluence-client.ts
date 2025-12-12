import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class ConfluenceClientError extends Error {
  status?: number;
  code?: string;
  details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = "ConfluenceClientError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ConfluenceClientError.prototype);
  }
}

export type ConfluencePage = {
  id: string;
  type?: string;
  status: string;
  title: string;
  spaceId: string;
  parentId?: string;
  body: {
    representation: string;
    value: string;
    storage?: {
      value: string;
      representation: string;
    };
  };
  version: {
    number: number;
    message?: string;
    minorEdit?: boolean;
    authorId?: string;
    createdAt?: string;
  };
  _links: {
    webui: string;
    self: string;
  };
};

export type CreatePageRequest = {
  title: string;
  spaceId: string;
  parentId?: string;
  status?: string;
  body: {
    representation: string;
    value: string;
  };
};

export type UpdatePageRequest = {
  id: string;
  title: string;
  spaceId: string;
  parentId?: string;
  status?: string;
  version: {
    number: number;
  };
  body: {
    representation: string;
    value: string;
  };
};

class ConfluenceClient {
  private client: any;
  public readonly baseUrl: string;

  /**
   * Get the base URL for constructing full URLs
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  constructor() {
    const confluencePat = process.env.CONFLUENCE_PAT;
    const confluenceEmail = process.env.CONFLUENCE_EMAIL;
    const confluenceApiToken = process.env.CONFLUENCE_API_TOKEN;
    const confluenceBaseUrl = process.env.CONFLUENCE_BASE_URL;

    // Support both PAT (Bearer) and Basic Auth (email + API token)
    // Note: If both are set, PAT takes precedence
    let authHeader: string;
    let authMethod: string;
    
    if (confluencePat) {
      // Personal Access Token uses Bearer auth
      authHeader = `Bearer ${confluencePat}`;
      authMethod = 'Bearer (PAT)';
    } else if (confluenceEmail && confluenceApiToken) {
      // API Token uses Basic auth with email:token
      const credentials = Buffer.from(`${confluenceEmail}:${confluenceApiToken}`).toString('base64');
      authHeader = `Basic ${credentials}`;
      authMethod = 'Basic (Email/API Token)';
    } else {
      throw new ConfluenceClientError(
        'Confluence authentication is required. Please set either CONFLUENCE_PAT (Personal Access Token for Bearer auth) or both CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN (for Basic auth). Note: API tokens are NOT the same as PATs - use CONFLUENCE_API_TOKEN with CONFLUENCE_EMAIL for API tokens.',
        undefined,
        'MISSING_CREDENTIALS',
        'Set CONFLUENCE_PAT for Bearer token auth, or CONFLUENCE_EMAIL + CONFLUENCE_API_TOKEN for Basic auth'
      );
    }

    // Base URL defaults to a cloud instance, but can be overridden
    // Remove trailing slashes and /wiki if present
    let baseUrl = confluenceBaseUrl || 'https://your-domain.atlassian.net';
    baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    baseUrl = baseUrl.replace(/\/wiki$/, ''); // Remove /wiki if present
    
    this.baseUrl = baseUrl;
    
    // Validate base URL format
    if (!this.baseUrl.includes('atlassian.net') && !this.baseUrl.includes('jira.com')) {
      console.warn(`Warning: Confluence base URL "${this.baseUrl}" doesn't look like a standard Atlassian Cloud URL. Expected format: https://your-domain.atlassian.net`);
    }
    
    this.client = axios.create({
      baseURL: `${this.baseUrl}/wiki/api/v2`,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
    
    console.log('Confluence client initialized:', {
      baseUrl: this.baseUrl,
      apiBaseUrl: `${this.baseUrl}/wiki/api/v2`,
      authType: authMethod,
      hasPat: !!confluencePat,
      hasEmail: !!confluenceEmail,
      hasApiToken: !!confluenceApiToken
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): ConfluenceClientError {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || data?.title || data?.detail || `HTTP ${status} error`;
      
      // Log full error response for debugging
      if (status === 404) {
        console.error('Confluence API 404 Error Details:', {
          status,
          data,
          url: error.config?.url,
          method: error.config?.method,
          requestData: error.config?.data ? JSON.parse(error.config.data) : null
        });
      }
      
      let enhancedMessage = 'Confluence API Error';
      let code = `HTTP_${status}`;
      let details = { ...data, fullResponse: data };

      if (status === 401) {
        enhancedMessage = 'Authentication failed. Please check your Confluence credentials (CONFLUENCE_PAT or CONFLUENCE_EMAIL/CONFLUENCE_API_TOKEN) have valid permissions.';
        code = 'AUTHENTICATION_ERROR';
      } else if (status === 403) {
        enhancedMessage = 'Access forbidden. Your Confluence account may not have the required permissions for this space or page.';
        code = 'AUTHORIZATION_ERROR';
      } else if (status === 404) {
        enhancedMessage = 'Resource not found. The page ID, space ID, or page title may not exist.';
        code = 'NOT_FOUND_ERROR';
      } else if (status === 400) {
        enhancedMessage = `Invalid request data. ${message || 'Please check your input parameters.'}`;
        code = 'VALIDATION_ERROR';
      } else if (status === 409) {
        enhancedMessage = 'Version conflict. The page was modified by another user. Please refresh the page and try again.';
        code = 'CONFLICT_ERROR';
      } else {
        enhancedMessage = `Confluence API Error: ${message}`;
      }

      return new ConfluenceClientError(enhancedMessage, status, code, details);
    } else if (error.request) {
      return new ConfluenceClientError(
        'Network error: Unable to reach Confluence API. Please check your connection and that the Confluence instance is accessible.',
        undefined,
        'NETWORK_ERROR',
        error.message
      );
    } else {
      return new ConfluenceClientError(
        `Request error: ${error.message}`,
        undefined,
        'REQUEST_ERROR',
        error.message
      );
    }
  }

  async getPageById(pageId: string): Promise<ConfluencePage> {
    if (!pageId || typeof pageId !== 'string') {
      throw new ConfluenceClientError(
        'Page ID is required and must be a valid string',
        undefined,
        'VALIDATION_ERROR',
        'Provide a valid Confluence page ID'
      );
    }

    // Request body content to be included in the response
    // Confluence Cloud API v2 requires body to be explicitly requested
    // Try with body-format parameter (some APIs use this format)
    const response = await this.client.get(`/pages/${pageId}`, {
      params: {
        'body-format': 'storage' // Request storage format (XHTML)
      }
    });
    
    // Log the FULL response structure for debugging
    console.log('Page response structure (full):', JSON.stringify({
      hasBody: !!response.data.body,
      bodyKeys: response.data.body ? Object.keys(response.data.body) : [],
      bodyStructure: response.data.body,
      fullResponseKeys: Object.keys(response.data),
      sampleResponse: {
        id: response.data.id,
        title: response.data.title,
        body: response.data.body
      }
    }, null, 2));
    
    return response.data;
  }

  async getPageByTitle(spaceId: string, title: string): Promise<ConfluencePage> {
    if (!spaceId || typeof spaceId !== 'string') {
      throw new ConfluenceClientError(
        'Space ID is required and must be a valid string',
        undefined,
        'VALIDATION_ERROR',
        'Provide a valid Confluence space ID'
      );
    }

    if (!title || typeof title !== 'string') {
      throw new ConfluenceClientError(
        'Page title is required and must be a valid string',
        undefined,
        'VALIDATION_ERROR',
        'Provide a valid page title to search for'
      );
    }

    // Search for pages in the space with the given title
    // Include bodyFormat to get the page content
    const response = await this.client.get('/pages', {
      params: {
        spaceId: spaceId,
        title: title,
        limit: 1,
        bodyFormat: 'storage' // Request storage format (XHTML)
      }
    });
    
    if (!response.data.results || response.data.results.length === 0) {
      throw new ConfluenceClientError(
        `Page with title "${title}" not found in space "${spaceId}". Please check the title and space ID are correct.`,
        404,
        'NOT_FOUND_ERROR',
        `Search performed in space: ${spaceId}, title: "${title}"`
      );
    }
    
    return response.data.results[0];
  }

  async updatePage(pageId: string, updateData: UpdatePageRequest): Promise<ConfluencePage> {
    if (!pageId || typeof pageId !== 'string') {
      throw new ConfluenceClientError(
        'Page ID is required and must be a valid string',
        undefined,
        'VALIDATION_ERROR',
        'Provide a valid Confluence page ID'
      );
    }

    if (!updateData || typeof updateData !== 'object') {
      throw new ConfluenceClientError(
        'Update data is required and must be an object with id, title, spaceId, version, and body',
        undefined,
        'VALIDATION_ERROR',
        'Provide update data with: { id: "...", title: "...", spaceId: "...", version: { number: X }, body: { representation: "storage", value: "..." } }'
      );
    }

    if (!updateData.version?.number) {
      throw new ConfluenceClientError(
        'Version number is required for page updates to prevent conflicts',
        undefined,
        'VALIDATION_ERROR',
        'Include the current version number: { version: { number: currentVersion + 1 } }'
      );
    }

    // Ensure the ID in the request matches the pageId parameter
    const requestData = {
      ...updateData,
      id: pageId,
    };

    const response = await this.client.put(`/pages/${pageId}`, requestData);
    return response.data;
  }

  async createPage(pageData: CreatePageRequest): Promise<ConfluencePage> {
    if (!pageData || typeof pageData !== 'object') {
      throw new ConfluenceClientError(
        'Page data is required and must contain title, spaceId, and body',
        undefined,
        'VALIDATION_ERROR',
        'Provide page data with: { title: "...", spaceId: "...", body: { representation: "storage", value: "..." } }'
      );
    }

    if (!pageData.spaceId) {
      throw new ConfluenceClientError(
        'Space ID is required in the format: { spaceId: "SPACE_ID" }',
        undefined,
        'VALIDATION_ERROR',
        'Specify the space ID where the page should be created'
      );
    }

    if (!pageData.title) {
      throw new ConfluenceClientError(
        'Page title is required',
        undefined,
        'VALIDATION_ERROR',
        'Provide a descriptive title for the page'
      );
    }

    if (!pageData.body?.value) {
      throw new ConfluenceClientError(
        'Page content is required in storage format',
        undefined,
        'VALIDATION_ERROR',
        'Provide page content in the body: { representation: "storage", value: "content" }'
      );
    }

    // Set default status if not provided
    // Ensure spaceId is numeric (API requires numeric spaceId)
    // Convert to number if it's a numeric string, otherwise keep as is for validation
    let spaceIdValue: string | number = pageData.spaceId;
    const spaceIdString = String(spaceIdValue);
    
    if (typeof spaceIdValue === 'string' && /^\d+$/.test(spaceIdString)) {
      // It's a numeric string - try as number first (Postman shows number in JSON)
      // But if that fails, we can try as string
      spaceIdValue = parseInt(spaceIdString, 10);
    } else if (spaceIdString.startsWith('~')) {
      // Personal space key - cannot be used directly
      throw new ConfluenceClientError(
        `Invalid spaceId format: "${spaceIdString}". The spaceId must be numeric (e.g., 197951488 or "197951488"). Personal space keys (starting with ~) cannot be used directly. Please provide the numeric space ID.`,
        undefined,
        'VALIDATION_ERROR',
        'Provide a numeric space ID'
      );
    } else if (typeof spaceIdValue === 'string' && !/^\d+$/.test(spaceIdString)) {
      // It's not numeric - this should have been caught earlier, but throw error here too
      throw new ConfluenceClientError(
        `Invalid spaceId format: "${spaceIdString}". The spaceId must be numeric (e.g., 197951488 or "197951488").`,
        undefined,
        'VALIDATION_ERROR',
        'Provide a numeric space ID'
      );
    }

    // Build request data exactly as Postman shows it working
    const requestData: any = {
      spaceId: spaceIdValue, // Use numeric value (number type)
      status: pageData.status || 'current',
      title: pageData.title,
      body: {
        representation: pageData.body.representation || 'storage',
        value: pageData.body.value,
      },
    };
    
    // Only add parentId if provided
    if (pageData.parentId) {
      requestData.parentId = typeof pageData.parentId === 'string' && /^\d+$/.test(pageData.parentId)
        ? parseInt(pageData.parentId, 10)
        : pageData.parentId;
    }

    try {
      // Log request for debugging (without sensitive content)
      const requestPayload = {
        title: requestData.title,
        spaceId: requestData.spaceId,
        status: requestData.status,
        body: {
          representation: requestData.body.representation,
          value: requestData.body.value.substring(0, 100) + '...' // Truncate for logging
        }
      };
      
      console.log('Creating Confluence page - Full request details:', {
        method: 'POST',
        url: `${this.baseUrl}/wiki/api/v2/pages`,
        baseUrl: this.baseUrl,
        requestPayload: JSON.stringify(requestPayload, null, 2),
        spaceId: requestData.spaceId,
        spaceIdType: typeof requestData.spaceId,
        hasParentId: !!requestData.parentId
      });

      const response = await this.client.post('/pages', requestData);
      console.log('Confluence API Response:', {
        status: response.status,
        data: response.data
      });
      return response.data;
    } catch (error: any) {
      // Enhanced error logging for debugging
      if (error instanceof ConfluenceClientError) {
        // Log full error details for debugging
        console.error('Confluence API Error Details:', {
          status: error.status,
          code: error.code,
          message: error.message,
          details: error.details,
          spaceId: pageData.spaceId,
          isPersonalSpace: pageData.spaceId.startsWith('~'),
          requestUrl: `${this.baseUrl}/wiki/api/v2/pages`
        });

        // Add request details to error for debugging
        if (error.status === 404) {
          // Check if it's a space not found error
          const errorDetails = error.details || {};
          const errorMessage = errorDetails.message || error.message || '';
          const fullErrorResponse = errorDetails.fullResponse || errorDetails;
          
          // For personal spaces, provide specific guidance
          if (pageData.spaceId.startsWith('~')) {
            throw new ConfluenceClientError(
              `Personal space not found or inaccessible. The personal spaceId "${pageData.spaceId}" may not exist, you may not have access to it, or personal spaces might require a different identifier format. Try: 1) Verify you have access to this personal space, 2) Check if you need to use a numeric space ID instead (you can find this in the space URL), 3) Ensure your authentication token has permissions for personal spaces. Full API response: ${JSON.stringify(fullErrorResponse)}`,
              error.status,
              error.code,
              { 
                ...error.details, 
                spaceId: pageData.spaceId,
                spaceIdType: typeof pageData.spaceId,
                isPersonalSpace: true,
                requestUrl: `${this.baseUrl}/wiki/api/v2/pages`,
                fullApiResponse: fullErrorResponse
              }
            );
          }
          
          // Provide more specific error message
          if (errorMessage.includes('space') || errorMessage.includes('Space')) {
            throw new ConfluenceClientError(
              `Space not found. The spaceId "${pageData.spaceId}" (type: ${typeof pageData.spaceId}) may not exist, may be incorrect, or you may not have access to it. Verify: 1) The space ID is correct (numeric string or number for regular spaces), 2) You have create permissions for this space, 3) The space exists in your Confluence instance. Full API response: ${JSON.stringify(fullErrorResponse)}`,
              error.status,
              error.code,
              { 
                ...error.details, 
                spaceId: pageData.spaceId,
                spaceIdType: typeof pageData.spaceId,
                requestUrl: `${this.baseUrl}/wiki/api/v2/pages`,
                fullApiResponse: fullErrorResponse
              }
            );
          }
          throw new ConfluenceClientError(
            `Resource not found (404). This could mean: 1) The spaceId "${pageData.spaceId}" doesn't exist, 2) You don't have access to create pages in this space, 3) The endpoint is incorrect. Verify the space ID format and permissions. Full API response: ${JSON.stringify(fullErrorResponse)}`,
            error.status,
            error.code,
            { ...error.details, spaceId: pageData.spaceId, fullApiResponse: fullErrorResponse }
          );
        }
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get space ID by space key (helper method)
   * Note: Confluence Cloud API v2 may not have a direct spaces endpoint
   * This method attempts to find a space by searching for pages in that space
   * For better performance, use spaceId directly when possible
   */
  async getSpaceIdByKey(spaceKey: string): Promise<string> {
    if (!spaceKey || typeof spaceKey !== 'string') {
      throw new ConfluenceClientError(
        'Space key is required and must be a valid string',
        undefined,
        'VALIDATION_ERROR',
        'Provide a valid Confluence space key'
      );
    }

    // Try to use the spaces API endpoint if available
    // Note: Confluence Cloud API v2 may use /wiki/api/v2/spaces or may require v1 API
    try {
      // First try v2 spaces endpoint
      const response = await this.client.get('/spaces', {
        params: {
          keys: spaceKey,
          limit: 1,
        }
      });

      // Cloud API v2 returns results array
      const results = response.data.results || response.data;
      if (results && (Array.isArray(results) ? results.length > 0 : true)) {
        const space = Array.isArray(results) ? results[0] : results;
        if (space && space.id) {
          return space.id;
        }
      }
    } catch (error) {
      // If v2 spaces endpoint doesn't work, try v1 API as fallback
      try {
        // Get headers from the existing client
        const existingHeaders = (this.client as any).defaults?.headers || {};
        const v1Client = axios.create({
          baseURL: `${this.baseUrl}/wiki/rest/api`,
          headers: { ...existingHeaders },
          timeout: 30000,
        });

        const response = await v1Client.get<{ id: string }>('/space', {
          params: {
            spaceKey: spaceKey.toUpperCase(),
          }
        });

        if (response.data && response.data.id) {
          return response.data.id;
        }
      } catch (v1Error) {
        // If both fail, throw the original error
        if (error instanceof ConfluenceClientError) {
          throw error;
        }
      }
    }

    // If we get here, space lookup failed
    throw new ConfluenceClientError(
      `Failed to find space with key "${spaceKey}". You may need to provide the space ID directly instead of the space key. To find the space ID, you can: 1) Check the space URL in Confluence (the space ID is in the URL), 2) Use the Confluence UI to inspect the space, or 3) Use a page in that space to get its spaceId.`,
      undefined,
      'SPACE_LOOKUP_ERROR',
      'Space key could not be resolved to space ID'
    );
  }
}

export const confluenceClient = new ConfluenceClient();
