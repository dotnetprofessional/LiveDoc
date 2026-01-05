/**
 * LiveDoc Unified Schema (vNext)
 * Re-exports canonical types from @livedoc/schema and defines server-specific types.
 */

export * from '@livedoc/schema';

// =============================================================================
// Server Configuration
// =============================================================================

export interface ServerConfig {
  port: number;
  host: string;
  dataDir?: string;         // Optional: persist to files
  historyLimit?: number;    // Max runs to keep per project/env
  corsOrigins?: string[];   // CORS allowed origins
}

// =============================================================================
// Client Configuration (for reporters)
// =============================================================================

export interface ReporterConfig {
  server?: string;          // Server URL, e.g., 'http://localhost:3000'
  project?: string;         // Auto-detected if not provided
  environment?: string;     // Defaults to 'local'
  mode?: 'live' | 'batch' | 'file';
  outputFile?: string;      // For file mode
  fallbackToFile?: boolean; // If server unavailable
  apiToken?: string;        // Optional auth
}
