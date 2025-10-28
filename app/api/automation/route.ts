import { NextRequest, NextResponse } from "next/server";

// In-memory storage for the automation status and results
// With Vercel Cron, the automation is always running via scheduled jobs
let automationState = {
  isRunning: true, // Always true since Vercel Cron handles scheduling
  lastCheck: null as Date | null,
  nextCheck: null as Date | null, // Will be calculated based on cron schedule
  lastResult: null as any,
  searchNumber: "590698",
  checkHistory: [] as any[],
};

// Calculate next cron execution time (every 4 hours: 0 */4 * * *)
function getNextCronTime(): Date {
  const now = new Date();
  const nextRun = new Date(now);

  // Find next 4-hour interval (0, 4, 8, 12, 16, 20)
  const currentHour = now.getHours();
  const nextHour = Math.ceil((currentHour + 1) / 4) * 4;

  if (nextHour >= 24) {
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(0, 0, 0, 0);
  } else {
    nextRun.setHours(nextHour, 0, 0, 0);
  }

  return nextRun;
}

// Update next check time
automationState.nextCheck = getNextCronTime();

// Function to perform a manual check (used by "Check Now" button)
async function performManualCheck() {
  try {
    console.log("Performing manual PDF check...");

    // Fetch PDF URL from embassy page
    const embassyResponse = await fetch(
      `${
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000"
      }/api/scrape-embassy`
    );
    const embassyData = await embassyResponse.json();

    if (!embassyData.success) {
      throw new Error(`Failed to fetch embassy PDF: ${embassyData.error}`);
    }

    // Check PDF for the specific number
    const pdfResponse = await fetch(
      `${
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000"
      }/api/pdf-checker`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfUrl: embassyData.pdfUrl,
          searchNumber: automationState.searchNumber,
        }),
      }
    );

    const pdfResult = await pdfResponse.json();

    const checkResult = {
      timestamp: new Date().toISOString(),
      pdfUrl: embassyData.pdfUrl,
      searchNumber: automationState.searchNumber,
      found: pdfResult.found,
      matchCount: pdfResult.matchCount || 0,
      error: pdfResult.error || null,
      success: !pdfResult.error,
      emailSent: false,
    };

    // Send email notification if number is found
    if (checkResult.found) {
      try {
        const emailResponse = await fetch(
          `${
            process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000"
          }/api/send-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "found",
              searchNumber: automationState.searchNumber,
              pdfUrl: embassyData.pdfUrl,
              matchCount: pdfResult.matchCount || 0,
              timestamp: checkResult.timestamp,
              contexts: pdfResult.contexts || [],
            }),
          }
        );

        if (emailResponse.ok) {
          console.log("✅ Manual check: Email notification sent");
          checkResult.emailSent = true;
        } else {
          console.error("❌ Manual check: Failed to send email notification");
          checkResult.emailSent = false;
        }
      } catch (emailError) {
        console.error("❌ Manual check: Email sending error:", emailError);
        checkResult.emailSent = false;
      }
    }

    // Update state and history
    automationState.lastCheck = new Date(checkResult.timestamp);
    automationState.lastResult = checkResult;
    automationState.checkHistory.unshift(checkResult);

    // Keep last 50 checks
    if (automationState.checkHistory.length > 50) {
      automationState.checkHistory = automationState.checkHistory.slice(0, 50);
    }

    console.log(
      `Manual check completed. Number ${automationState.searchNumber} found: ${checkResult.found}`
    );
    return checkResult;
  } catch (error) {
    console.error("Error in manual check:", error);

    const errorResult = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
      emailSent: false,
    };

    automationState.lastCheck = new Date(errorResult.timestamp);
    automationState.lastResult = errorResult;
    automationState.checkHistory.unshift(errorResult);

    return errorResult;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, result } = body;

    if (action === "store-result") {
      // Store result from cron job
      if (result) {
        automationState.lastCheck = new Date(result.timestamp);
        automationState.lastResult = result;
        automationState.nextCheck = getNextCronTime();

        // Add to history (keep last 50 checks)
        automationState.checkHistory.unshift(result);
        if (automationState.checkHistory.length > 50) {
          automationState.checkHistory = automationState.checkHistory.slice(
            0,
            50
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: "Result stored successfully",
      });
    } else if (action === "check-now") {
      // Perform immediate manual check
      const result = await performManualCheck();

      return NextResponse.json({
        success: true,
        message: "Manual check completed",
        result,
      });
    } else {
      return NextResponse.json(
        {
          error: "Invalid action. Use 'check-now' or 'store-result'",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Automation API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process automation request",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    isRunning: automationState.isRunning,
    searchNumber: automationState.searchNumber,
    lastCheck: automationState.lastCheck,
    nextCheck: automationState.nextCheck,
    lastResult: automationState.lastResult,
    checkHistory: automationState.checkHistory.slice(0, 10), // Return last 10 checks
    totalChecks: automationState.checkHistory.length,
  });
}
