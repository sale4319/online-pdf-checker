import { NextRequest, NextResponse } from "next/server";

// In-memory storage for the automation status and results
// In a production environment, you'd want to use a database
let automationState = {
  isRunning: false,
  lastCheck: null as Date | null,
  nextCheck: null as Date | null,
  lastResult: null as any,
  searchNumber: "590698",
  intervalId: null as NodeJS.Timeout | null,
  checkHistory: [] as any[],
};

async function performAutomatedCheck() {
  try {
    console.log("Performing automated PDF check...");

    // Fetch PDF URL from embassy page
    const embassyResponse = await fetch(
      `${process.env.VERCEL_URL || "http://localhost:3000"}/api/scrape-embassy`
    );
    const embassyData = await embassyResponse.json();

    if (!embassyData.success) {
      throw new Error(`Failed to fetch embassy PDF: ${embassyData.error}`);
    }

    // Check PDF for the specific number
    const pdfResponse = await fetch(
      `${process.env.VERCEL_URL || "http://localhost:3000"}/api/pdf-checker`,
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
      timestamp: new Date(),
      pdfUrl: embassyData.pdfUrl,
      searchNumber: automationState.searchNumber,
      found: pdfResult.found,
      matchCount: pdfResult.matchCount,
      error: pdfResult.error || null,
      success: !pdfResult.error,
      emailSent: false,
    };

    // Update automation state
    automationState.lastCheck = new Date();
    automationState.nextCheck = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now
    automationState.lastResult = checkResult;

    // Add to history (keep last 50 checks)
    automationState.checkHistory.unshift(checkResult);
    if (automationState.checkHistory.length > 50) {
      automationState.checkHistory = automationState.checkHistory.slice(0, 50);
    }

    console.log(
      `Automated check completed. Number ${automationState.searchNumber} found: ${checkResult.found}`
    );

    // Send email notification if number is found
    if (checkResult.found) {
      try {
        const emailResponse = await fetch(
          `${process.env.VERCEL_URL || "http://localhost:3000"}/api/send-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "found",
              searchNumber: automationState.searchNumber,
              pdfUrl: embassyData.pdfUrl,
              matchCount: pdfResult.matchCount,
              timestamp: checkResult.timestamp,
              contexts: pdfResult.contexts || [],
            }),
          }
        );

        if (emailResponse.ok) {
          console.log(
            `✅ Email notification sent for found number ${automationState.searchNumber}`
          );
          checkResult.emailSent = true;
        } else {
          console.error("❌ Failed to send email notification");
          checkResult.emailSent = false;
        }
      } catch (emailError) {
        console.error("❌ Email sending error:", emailError);
        checkResult.emailSent = false;
      }
    }

    return checkResult;
  } catch (error) {
    console.error("Error in automated check:", error);

    const errorResult = {
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
      emailSent: false,
    };

    automationState.lastCheck = new Date();
    automationState.nextCheck = new Date(Date.now() + 4 * 60 * 60 * 1000);
    automationState.lastResult = errorResult;
    automationState.checkHistory.unshift(errorResult);

    // Send email notification for critical errors (optional, can be enabled if needed)
    // Uncomment the block below if you want to receive email notifications for errors too
    /*
    try {
      await fetch(
        `${process.env.VERCEL_URL || "http://localhost:3000"}/api/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "error",
            searchNumber: automationState.searchNumber,
            timestamp: errorResult.timestamp,
            error: errorResult.error,
          }),
        }
      );
      errorResult.emailSent = true;
    } catch (emailError) {
      console.error("Failed to send error notification email:", emailError);
    }
    */

    return errorResult;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, searchNumber } = body;

    if (action === "start") {
      if (automationState.isRunning) {
        return NextResponse.json(
          {
            error: "Automation is already running",
          },
          { status: 400 }
        );
      }

      // Update search number if provided
      if (searchNumber) {
        automationState.searchNumber = searchNumber;
      }

      // Perform immediate check
      await performAutomatedCheck();

      // Set up interval for every 4 hours (4 * 60 * 60 * 1000 ms)
      automationState.intervalId = setInterval(
        performAutomatedCheck,
        4 * 60 * 60 * 1000
      );
      automationState.isRunning = true;

      return NextResponse.json({
        success: true,
        message: "Automation started successfully",
        searchNumber: automationState.searchNumber,
        nextCheck: automationState.nextCheck,
        lastResult: automationState.lastResult,
      });
    } else if (action === "stop") {
      if (!automationState.isRunning) {
        return NextResponse.json(
          {
            error: "Automation is not running",
          },
          { status: 400 }
        );
      }

      if (automationState.intervalId) {
        clearInterval(automationState.intervalId);
        automationState.intervalId = null;
      }

      automationState.isRunning = false;
      automationState.nextCheck = null;

      return NextResponse.json({
        success: true,
        message: "Automation stopped successfully",
      });
    } else if (action === "check-now") {
      // Perform immediate check
      const result = await performAutomatedCheck();

      return NextResponse.json({
        success: true,
        message: "Manual check completed",
        result,
      });
    } else {
      return NextResponse.json(
        {
          error: "Invalid action. Use 'start', 'stop', or 'check-now'",
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
