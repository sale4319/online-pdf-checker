import { PrintResultsProps } from "../types";

const PrintResults = ({ result }: PrintResultsProps) => {
  if (!result) return null;

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-md">
      {result.autoFetchSuccess && (
        <div className="text-green-600 mb-4 text-pretty">
          <h3 className="font-semibold">Success:</h3>
          <p>
            {result.autoFetchSuccess.length > 50
              ? `${result.autoFetchSuccess.substring(0, 50)}...`
              : result.autoFetchSuccess}
          </p>
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
                  ? "📧 Email notification sent to sa****19@gmail.com"
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
              {result.fileSize ? Math.round(result.fileSize / 1024) : "N/A"} KB
            </p>
            <p className="text-gray-500">
              <strong>Search Number:</strong> {result.searchNumber}
            </p>
            <p className={result.found ? "text-green-600" : "text-red-600"}>
              <strong>Found:</strong> {result.found ? "Yes" : "No"}
            </p>
            {result.found && (
              <>
                <p className="text-gray-500">
                  <strong>Match Count:</strong> {result.matchCount}
                </p>
                {result.contexts && result.contexts.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-500 mt-4 mb-2">
                      Context around matches:
                    </h4>
                    <div className="space-y-2">
                      {result.contexts.map((context: string, index: number) => (
                        <div
                          key={index}
                          className="bg-white p-3 rounded border text-sm"
                        >
                          <p className="text-gray-500">{context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PrintResults;
