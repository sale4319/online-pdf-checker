"use client";

import { useState } from "react";
import PrintResults from "./PrintResults";
import { ComponentResult } from "../types";

const ManualCheck = () => {
  const [result, setResult] = useState<ComponentResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEmbassy, setLoadingEmbassy] = useState(false);

  const [isManualCollapsed, setIsManualCollapsed] = useState(true);

  const handleAutoFetch = async () => {
    setLoadingEmbassy(true);
    try {
      const response = await fetch("/api/scrape-embassy");

      if (!response.ok) {
        setResult({
          error: `Failed to fetch embassy page (status ${response.status})`,
        });
        return;
      }

      const data = await response.json();

      if (data.success) {
        setPdfUrl(data.pdfUrl);
        setResult({
          autoFetchSuccess: `Successfully found PDF URL: ${data.pdfUrl}`,
        });
      } else {
        setResult({
          error: data.error || "Failed to auto-fetch PDF URL",
        });
      }
    } catch (error) {
      setResult({
        error: "Failed to connect to embassy page",
      });
    } finally {
      setLoadingEmbassy(false);
    }
  };
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
    <div className="bg-white rounded-lg shadow">
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
                  {loadingEmbassy ? "Fetching..." : "Fetch"}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Use "Auto-fetch" to automatically get the latest PDF from the
                German Embassy Belgrade page
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

          <PrintResults result={result} />
        </div>
      )}
    </div>
  );
};

export default ManualCheck;
