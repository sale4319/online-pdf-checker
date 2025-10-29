import { CheckResult, AutomationStatus } from "@/lib/database";

// Result state for ManualCheck and AutomaticMonitoring components
export interface ComponentResult {
  autoFetchSuccess?: string;
  manualCheck?: CheckResult;
  emailTest?: string;
  error?: string;
  // For manual PDF checker results (from /api/pdf-checker)
  found?: boolean;
  matchCount?: number;
  contexts?: string[];
  pdfUrl?: string;
  searchNumber?: string;
  fileSize?: number;
}

// Props for PrintResults component
export interface PrintResultsProps {
  result: ComponentResult | null;
}

// Automation status response from API
export interface AutomationStatusResponse
  extends Omit<AutomationStatus, "_id" | "createdAt" | "updatedAt"> {
  checkHistory?: CheckResult[];
  totalChecks?: number;
}
