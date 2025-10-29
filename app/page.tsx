import "server-only";

import { ManualCheck, AutomaticMonitoring } from "./components";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">
          Automated List Checker
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Search for specific numbers in PDF files
        </p>

        <ManualCheck />

        <AutomaticMonitoring />
      </div>
    </div>
  );
}
