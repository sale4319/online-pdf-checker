"use client";

import { useState, useEffect } from "react";
import PrintResults from "./PrintResults";
import { ComponentResult, AutomationStatusResponse } from "../types";

const AutomaticMonitoring = () => {
  const [result, setResult] = useState<ComponentResult | null>(null);
  const [automationStatus, setAutomationStatus] =
    useState<AutomationStatusResponse | null>(null);
  const [loadingAutomation, setLoadingAutomation] = useState(false);

  const fetchAutomationStatus = async () => {
    try {
      const response = await fetch("/api/automation");

      if (!response.ok) {
        console.error(`Failed to fetch automation status: ${response.status}`);
        return;
      }

      const data = await response.json();
      setAutomationStatus(data);
    } catch (error) {
      console.error("Failed to fetch automation status:", error);
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

        // Check if response is ok before parsing JSON
        if (!response.ok) {
          console.error(
            `Scheduled check failed with status: ${response.status}`
          );
          return;
        }

        const data = await response.json();

        if (data.success) {
          console.log("✅ Scheduled check completed:", data.message);
          // The AutomaticMonitoring component will refresh its own status
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

  const handleCheckNow = async () => {
    setLoadingAutomation(true);
    try {
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-now" }),
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Manual check failed with status: ${response.status}`,
          errorText
        );
        setResult({
          error: `Manual check failed with status ${response.status}`,
        });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setResult({
          manualCheck: data.result,
        });
        fetchAutomationStatus();
      } else {
        setResult({
          error: data.error || "Manual check failed",
        });
      }
    } catch (error) {
      console.error("Manual check error:", error);
      setResult({
        error:
          "Failed to perform manual check: " +
          (error instanceof Error ? error.message : "Unknown error"),
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

      if (!response.ok) {
        setResult({
          error: `Email test failed with status ${response.status}`,
        });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setResult({
          emailTest: `✅ Test email sent successfully! Check sa****19@gmail.com inbox.`,
        });
      } else {
        setResult({
          error: `Email test failed: ${data.details || data.error}`,
        });
      }
    } catch (error) {
      setResult({
        error: "Failed to test email configuration",
      });
    } finally {
      setLoadingAutomation(false);
    }
  };
  return (
    <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <h2 className="text-xl text-gray-500 font-semibold text-blue-900 mb-4">
        🕒 Automated Monitoring
      </h2>
      <p className="text-blue-700 mb-4 text-sm">
        Automatic checking runs 3 times daily at 8:00, 12:00, and 16:00 to
        monitor when the number appears in the embassy PDF. An email
        notification will be sent to
        <strong className="text-blue-900"> sa****19@gmail.com</strong> when the
        number is found.{" "}
      </p>
      {automationStatus && (
        <div className="mb-4 p-3 bg-white rounded border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-gray-500">
              <strong>Status:</strong>
              <span className="ml-1 text-green-600">🕒 Always Active</span>
            </div>
            <div className="text-gray-500">
              <strong>Search Number:</strong> {automationStatus.searchNumber}
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
                        ? "📧 Email notification sent to sa****19@gmail.com"
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

      <PrintResults result={result} />
    </div>
  );
};

export default AutomaticMonitoring;
