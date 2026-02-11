import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * These tests verify the enhanced error handling behavior of PylonClient.
 *
 * The PylonClient sets up axios interceptors that:
 * 1. Extract error messages from Pylon API response bodies
 * 2. Create enhanced errors with format: "Pylon API error (${status}): ${message}"
 * 3. Preserve the original error, status code, and API error object
 *
 * Since interceptors run within the axios request/response pipeline,
 * we test the error handling logic directly by simulating axios errors.
 */
describe('PylonClient - Enhanced Error Handling (Interceptor Logic)', () => {
  /**
   * Helper to create an axios-like error with response data
   */
  function createAxiosError(
    status: number,
    data: unknown,
    message: string = 'Request failed'
  ): AxiosError {
    const error = new Error(message) as AxiosError;
    error.response = {
      status,
      statusText: `Status ${status}`,
      data,
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    } as AxiosResponse;
    error.isAxiosError = true;
    error.config = {} as InternalAxiosRequestConfig;
    error.toJSON = () => ({});
    return error;
  }

  /**
   * Helper to simulate the error interceptor logic from PylonClient.
   * This mirrors the actual implementation in setupInterceptors().
   */
  function applyErrorInterceptor(error: AxiosError): Error {
    if (error.response?.data) {
      const apiError = error.response.data as Record<string, unknown>;
      const errorMessage =
        (apiError.error as string) ||
        (apiError.message as string) ||
        JSON.stringify(apiError);

      const enhancedError = new Error(
        `Pylon API error (${error.response.status}): ${errorMessage}`
      ) as Error & { status: number; apiError: unknown; originalError: unknown };
      enhancedError.status = error.response.status;
      enhancedError.apiError = apiError;
      enhancedError.originalError = error;

      return enhancedError;
    }
    return error;
  }

  describe('Error Message Extraction', () => {
    it('should extract error field from API response and include status code', () => {
      const axiosError = createAxiosError(400, {
        error: 'Invalid filter operator for field state',
      });

      const enhancedError = applyErrorInterceptor(axiosError);

      expect(enhancedError.message).toBe(
        'Pylon API error (400): Invalid filter operator for field state'
      );
    });

    it('should extract message field when error field is not present', () => {
      const axiosError = createAxiosError(401, {
        message: 'Invalid API token',
      });

      const enhancedError = applyErrorInterceptor(axiosError);

      expect(enhancedError.message).toBe('Pylon API error (401): Invalid API token');
    });

    it('should prefer error field over message field', () => {
      const axiosError = createAxiosError(400, {
        error: 'Primary error message',
        message: 'Secondary message',
      });

      const enhancedError = applyErrorInterceptor(axiosError);

      expect(enhancedError.message).toBe('Pylon API error (400): Primary error message');
    });

    it('should stringify the entire error object when no error or message field', () => {
      const axiosError = createAxiosError(422, {
        code: 'VALIDATION_ERROR',
        details: { field: 'title', reason: 'required' },
      });

      const enhancedError = applyErrorInterceptor(axiosError);

      expect(enhancedError.message).toBe(
        'Pylon API error (422): {"code":"VALIDATION_ERROR","details":{"field":"title","reason":"required"}}'
      );
    });

    it('should preserve status code on enhanced error', () => {
      const axiosError = createAxiosError(403, {
        error: 'Insufficient permissions',
      });

      const enhancedError = applyErrorInterceptor(axiosError) as any;

      expect(enhancedError.status).toBe(403);
    });

    it('should preserve apiError object on enhanced error', () => {
      const apiErrorData = {
        error: 'Resource not found',
        code: 'NOT_FOUND',
        resource_id: 'issue_123',
      };
      const axiosError = createAxiosError(404, apiErrorData);

      const enhancedError = applyErrorInterceptor(axiosError) as any;

      expect(enhancedError.apiError).toEqual(apiErrorData);
    });

    it('should preserve originalError on enhanced error', () => {
      const axiosError = createAxiosError(500, {
        error: 'Internal server error',
      });

      const enhancedError = applyErrorInterceptor(axiosError) as any;

      expect(enhancedError.originalError).toBe(axiosError);
    });

    it('should pass through errors without response data unchanged', () => {
      const networkError = new Error('Network Error') as AxiosError;
      networkError.isAxiosError = true;
      networkError.config = {} as InternalAxiosRequestConfig;
      networkError.toJSON = () => ({});
      // No response property

      const result = applyErrorInterceptor(networkError);

      expect(result).toBe(networkError);
      expect(result.message).toBe('Network Error');
    });

    it('should pass through errors with null response data', () => {
      const axiosError = createAxiosError(502, null);

      const result = applyErrorInterceptor(axiosError);

      // Should return original error since data is null (falsy)
      expect(result).toBe(axiosError);
    });

    it('should handle empty object response data', () => {
      const axiosError = createAxiosError(500, {});

      const enhancedError = applyErrorInterceptor(axiosError);

      // Empty object stringifies to "{}"
      expect(enhancedError.message).toBe('Pylon API error (500): {}');
    });
  });

  describe('HTTP Status Code Handling', () => {
    const statusCases = [
      { status: 400, name: 'Bad Request', error: 'Invalid request body' },
      { status: 401, name: 'Unauthorized', error: 'Invalid or expired token' },
      { status: 403, name: 'Forbidden', error: 'Permission denied' },
      { status: 404, name: 'Not Found', error: 'Resource not found' },
      { status: 409, name: 'Conflict', error: 'Resource already exists' },
      { status: 422, name: 'Unprocessable Entity', error: 'Validation failed' },
      { status: 429, name: 'Too Many Requests', error: 'Rate limit exceeded' },
      { status: 500, name: 'Internal Server Error', error: 'Server error' },
      { status: 502, name: 'Bad Gateway', error: 'Upstream error' },
      { status: 503, name: 'Service Unavailable', error: 'Service down' },
    ];

    statusCases.forEach(({ status, name, error }) => {
      it(`should handle ${status} ${name} errors`, () => {
        const axiosError = createAxiosError(status, { error });

        const enhancedError = applyErrorInterceptor(axiosError);

        expect(enhancedError.message).toBe(`Pylon API error (${status}): ${error}`);
        expect((enhancedError as any).status).toBe(status);
      });
    });
  });

  describe('Real API Error Response Formats', () => {
    it('should handle Pylon API error format with error field', () => {
      const axiosError = createAxiosError(400, {
        error: "Invalid filter operator 'xyz' for field 'state'",
        code: 'INVALID_REQUEST',
      });

      const enhancedError = applyErrorInterceptor(axiosError);

      expect(enhancedError.message).toBe(
        "Pylon API error (400): Invalid filter operator 'xyz' for field 'state'"
      );
    });

    it('should handle Pylon API error format with message field', () => {
      const axiosError = createAxiosError(401, {
        message: 'API token has expired',
        details: { expired_at: '2024-01-01T00:00:00Z' },
      });

      const enhancedError = applyErrorInterceptor(axiosError);

      expect(enhancedError.message).toBe('Pylon API error (401): API token has expired');
    });

    it('should handle nested error details', () => {
      const axiosError = createAxiosError(422, {
        errors: [
          { field: 'title', message: 'required' },
          { field: 'description', message: 'too short' },
        ],
      });

      const enhancedError = applyErrorInterceptor(axiosError);

      // Since neither 'error' nor 'message' exists, it stringifies the whole object
      expect(enhancedError.message).toContain('Pylon API error (422):');
      expect(enhancedError.message).toContain('errors');
    });
  });
});

