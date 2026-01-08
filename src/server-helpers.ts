/**
 * Server helper functions and utilities for the Pylon MCP Server.
 * Extracted for testability.
 */

import { PylonClient } from './pylon-client.js';

/**
 * Parse and validate the PYLON_CACHE_TTL environment variable.
 * @param envValue - The raw environment variable value
 * @returns The parsed TTL value, or undefined if not set
 * @throws Error if the value is set but not a valid integer
 */
export function parseCacheTtl(envValue: string | undefined): number | undefined {
  if (envValue === undefined) {
    return undefined;
  }
  // Validate that the value is a pure integer string (with optional leading minus sign)
  // This prevents parseInt from accepting partial numeric prefixes like "5000ms"
  if (!/^-?\d+$/.test(envValue.trim())) {
    throw new Error(
      `Invalid PYLON_CACHE_TTL value: "${envValue}". Must be a valid integer (e.g., "5000", "0", "-1").`
    );
  }
  return parseInt(envValue, 10);
}

/**
 * Create a PylonClient instance if the API token is available.
 * @param apiToken - The Pylon API token
 * @param cacheTtl - Optional cache TTL in milliseconds
 * @returns PylonClient instance or null if no token
 */
export function createPylonClient(
  apiToken: string | undefined,
  cacheTtl?: number
): PylonClient | null {
  if (!apiToken) {
    return null;
  }
  return new PylonClient({
    apiToken,
    cacheTtl,
  });
}

/**
 * Helper function to ensure pylonClient is initialized.
 * @param client - The PylonClient instance (may be null)
 * @returns The PylonClient instance
 * @throws Error if client is null
 */
export function ensurePylonClient(client: PylonClient | null): PylonClient {
  if (!client) {
    throw new Error('PYLON_API_TOKEN environment variable is required');
  }
  return client;
}

/**
 * Helper to create a JSON text response for MCP tools.
 * @param data - The data to serialize
 * @returns MCP tool response with JSON content (text is always a string)
 */
export function jsonResponse(data: unknown) {
  // JSON.stringify(undefined) returns undefined, so we need to handle that case
  // to ensure text is always a string for MCP protocol compliance
  const text = JSON.stringify(data, null, 2) ?? 'null';
  return { content: [{ type: 'text' as const, text }] };
}
