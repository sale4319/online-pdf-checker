"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEmbassy, setLoadingEmbassy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [automationStatus, setAutomationStatus] = useState<any>(null);
  const [loadingAutomation, setLoadingAutomation] = useState(false);

  const [isManualCollapsed, setIsManualCollapsed] = useState(true);

  const handleAutoFetch = async () => {
    setLoadingEmbassy(true);
    try {
      const response = await fetch("/api/scrape-embassy");
      const data = await response.json();

      if (data.success) {
        setPdfUrl(data.pdfUrl);
        setResult({
          ...result,
          autoFetchSuccess: `Successfully found PDF URL: ${data.pdfUrl}`,
        });
      } else {
        setResult({
          ...result,
          error: data.error || "Failed to auto-fetch PDF URL",
        });
      }
    } catch (error) {
      setResult({
        ...result,
        error: "Failed to connect to embassy page",
      });
    } finally {
      setLoadingEmbassy(false);
    }
  };

  const fetchAutomationStatus = async () => {
    try {
      const response = await fetch("/api/automation");
      const data = await response.json();
      setAutomationStatus(data);
    } catch (error) {
      console.error("Failed to fetch automation status:", error);
    }
  };

  const handleCheckNow = async () => {
    setLoadingAutomation(true);
    try {
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-now" }),
      });
      const data = await response.json();

      if (data.success) {
        setResult({
          ...result,
          manualCheck: data.result,
        });
        fetchAutomationStatus();
      } else {
        setResult({
          ...result,
          error: data.error || "Manual check failed",
        });
      }
    } catch (error) {
      setResult({
        ...result,
        error: "Failed to perform manual check",
      });
    } finally {
      setLoadingAutomation(false);
    }
  };

  const handleTestEmail = async () => {
    setLoadingAutomation(true);
    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (data.success) {
        setResult({
          ...result,
          emailTest: `✅ Test email sent successfully! Check sale4319@gmail.com inbox.`,
        });
      } else {
        setResult({
          ...result,
          error: `Email test failed: ${data.details || data.error}`,
        });
      }
    } catch (error) {
      setResult({
        ...result,
        error: "Failed to test email configuration",
      });
    } finally {
      setLoadingAutomation(false);
    }
  };

  // Load automation status on component mount
  useEffect(() => {
    fetchAutomationStatus();
  }, []);

  // Background polling to trigger scheduled checks
  useEffect(() => {
    const pollInterval = 5 * 60 * 1000; // Poll every 5 minutes

    const triggerScheduledCheck = async () => {
      try {
        const response = await fetch("/api/scheduled-check", {
          headers: {
            authorization: `Bearer ${
              process.env.NEXT_PUBLIC_SCHEDULED_CHECK_SECRET ||
              "your-secret-key"
            }`,
          },
        });
        const data = await response.json();

        if (data.success) {
          console.log("✅ Scheduled check completed:", data.message);
          // Refresh automation status to show latest results
          fetchAutomationStatus();
        } else {
          console.log("ℹ️ Scheduled check:", data.message || data.error);
        }
      } catch (error) {
        console.error("Failed to trigger scheduled check:", error);
      }
    };

    // Run immediately on mount
    triggerScheduledCheck();

    // Then poll at intervals
    const intervalId = setInterval(triggerScheduledCheck, pollInterval);

    return () => clearInterval(intervalId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfUrl || !searchNumber) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/pdf-checker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfUrl,
          searchNumber,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: "Failed to process request" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">
          Automated List Checker
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Search for specific numbers in PDF files
        </p>

        <div className="bg-white rounded-lg shadow">
          {/* Manual Check Header */}
          <div
            className="p-6 border-b cursor-pointer flex justify-between items-center hover:bg-gray-50"
            onClick={() => setIsManualCollapsed(!isManualCollapsed)}
          >
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Manual PDF Check
              </h2>
              <p className="text-sm text-gray-600">
                Search for numbers in a specific PDF file
              </p>
            </div>
            <div className="text-gray-500">
              {isManualCollapsed ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              )}
            </div>
          </div>

          {!isManualCollapsed && (
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDF URL
                  </label>
                  <input
                    type="url"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    placeholder="Enter the URL of the PDF file..."
                    className="block w-full px-3 text-gray-400 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    required
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Enter a direct link to a PDF file (e.g.,
                      https://example.com/document.pdf)
                    </p>
                    <button
                      type="button"
                      onClick={handleAutoFetch}
                      disabled={loadingEmbassy}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingEmbassy ? "Fetching..." : "Auto-Fetch"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Use "Auto-fetch" to automatically get the latest PDF from
                    the German Embassy Belgrade page
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Number
                  </label>
                  <input
                    type="text"
                    value={searchNumber}
                    onChange={(e) => setSearchNumber(e.target.value)}
                    placeholder="Enter the number to search for..."
                    className="block w-full px-3 py-2 text-gray-400 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !pdfUrl || !searchNumber}
                  className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Search PDF"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Automation Controls */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-xl text-gray-500 font-semibold text-blue-900 mb-4">
            🕒 Automated Monitoring
          </h2>
          <p className="text-blue-700 mb-4 text-sm">
            Automatic checking runs 3 times daily at 8:00, 12:00, and 16:00 to
            monitor when the number appears in the embassy PDF. An email
            notification will be sent to
            <strong className="text-blue-900"> sa****19@gmail.com</strong> when
            the number is found.{" "}
          </p>
          {automationStatus && (
            <div className="mb-4 p-3 bg-white rounded border">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-gray-500">
                  <strong>Status:</strong>
                  <span className="ml-1 text-green-600">🕒 Always Active</span>
                </div>
                <div className="text-gray-500">
                  <strong>Search Number:</strong>{" "}
                  {automationStatus.searchNumber}
                </div>
                {automationStatus.lastCheck && (
                  <div className="text-gray-500">
                    <strong>Last Check:</strong>{" "}
                    {new Date(automationStatus.lastCheck).toLocaleString()}
                  </div>
                )}
                {automationStatus.nextCheck && (
                  <div className="text-gray-500">
                    <strong>Next Check:</strong>{" "}
                    {new Date(automationStatus.nextCheck).toLocaleString()}
                  </div>
                )}
                {automationStatus.lastResult && (
                  <div className="col-span-2 text-gray-500">
                    <strong>Last Result:</strong>
                    <span
                      className={`ml-1 ${
                        automationStatus.lastResult.found
                          ? "text-green-600 font-semibold"
                          : "text-gray-600"
                      }`}
                    >
                      {automationStatus.lastResult.found
                        ? `✅ Number found! (${automationStatus.lastResult.matchCount} matches)`
                        : "❌ Number not found"}
                    </span>
                    {automationStatus.lastResult.found && (
                      <div className="mt-2 text-xs">
                        <span
                          className={`${
                            automationStatus.lastResult.emailSent
                              ? "text-green-600"
                              : "text-orange-600"
                          }`}
                        >
                          {automationStatus.lastResult.emailSent
                            ? "📧 Email notification sent to sale4319@gmail.com"
                            : "📧 Email notification failed"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-3 flex-wrap justify-between">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleCheckNow}
                disabled={loadingAutomation}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAutomation ? "Checking..." : "Check Now"}
              </button>
            </div>
            <button
              onClick={handleTestEmail}
              disabled={loadingAutomation}
              className="px-4 py-2 bg-light-blue-600 text-white font-medium rounded-md hover:bg-light-blue-700 focus:outline-none focus:ring-2 focus:ring-light-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📤
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            {result.autoFetchSuccess && (
              <div className="text-green-600 mb-4">
                <h3 className="font-semibold">Success:</h3>
                <p>{result.autoFetchSuccess}</p>
              </div>
            )}

            {result.manualCheck && (
              <div className="text-blue-600 mb-4">
                <h3 className="font-semibold">Manual Check Result:</h3>
                <p>
                  Number 590698{" "}
                  {result.manualCheck.found
                    ? `✅ FOUND! (${result.manualCheck.matchCount} matches)`
                    : "❌ Not found"}{" "}
                  - Checked at{" "}
                  {new Date(result.manualCheck.timestamp).toLocaleString()}
                </p>
                {result.manualCheck.pdfUrl && (
                  <p className="text-sm">
                    PDF:{" "}
                    <a
                      href={result.manualCheck.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                      title={result.manualCheck.pdfUrl}
                    >
                      {result.manualCheck.pdfUrl.length > 50
                        ? `${result.manualCheck.pdfUrl.substring(0, 40)}...`
                        : result.manualCheck.pdfUrl}
                    </a>
                  </p>
                )}
                {result.manualCheck.found &&
                  result.manualCheck.emailSent !== undefined && (
                    <p
                      className={`text-sm mt-2 ${
                        result.manualCheck.emailSent
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {result.manualCheck.emailSent
                        ? "📧 Email notification sent to sale4319@gmail.com"
                        : "📧 Email notification failed"}
                    </p>
                  )}
              </div>
            )}
            {result.emailTest && (
              <div className="text-green-600 mb-4">
                <h3 className="font-semibold">Email Test:</h3>
                <p>{result.emailTest}</p>
              </div>
            )}
            {result.error ? (
              <div className="text-red-600">
                <h3 className="font-semibold">Error:</h3>
                <p>{result.error}</p>
              </div>
            ) : result.found !== undefined ? (
              <div>
                <h3 className="font-semibold text-gray-500 mb-3">Results</h3>
                <div className="space-y-2">
                  <p className="text-gray-500">
                    <strong>PDF URL:</strong>
                    <a
                      href={result.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 ml-1 break-all"
                    >
                      {result.pdfUrl}
                    </a>
                  </p>
                  <p className="text-gray-500">
                    <strong>File Size:</strong>{" "}
                    {Math.round(result.fileSize / 1024)} KB
                  </p>
                  <p className="text-gray-500">
                    <strong>Search Number:</strong> {result.searchNumber}
                  </p>
                  <p
                    className={result.found ? "text-green-600" : "text-red-600"}
                  >
                    <strong>Found:</strong> {result.found ? "Yes" : "No"}
                  </p>
                  {result.found && (
                    <>
                      <p className="text-gray-500">
                        <strong>Match Count:</strong> {result.matchCount}
                      </p>
                      {result.contexts.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-500 mt-4 mb-2">
                            Context around matches:
                          </h4>
                          <div className="space-y-2">
                            {result.contexts.map(
                              (context: string, index: number) => (
                                <div
                                  key={index}
                                  className="bg-white p-3 rounded border text-sm"
                                >
                                  <p className="text-gray-500">{context}</p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
