import { NextRequest, NextResponse } from "next/server";
import { DatabaseService, CheckResult } from "../../../lib/database";

// Calculate next cron execution time (daily at 12:00: 0 12 * * *)
function getNextCronTime(): Date {
  const now = new Date();
  const nextRun = new Date(now);

  const cronHour = 12;

  if (now.getHours() >= cronHour) {
    // Already past today's run, schedule for tomorrow
    nextRun.setDate(nextRun.getDate() + 1);
  }

  nextRun.setHours(cronHour, 0, 0, 0);

  return nextRun;
}
export async function GET() {
  try {
    // Get automation status and recent checks from database
    const automationStatus = await DatabaseService.getAutomationStatus();
    const recentChecks = await DatabaseService.getRecentChecks(10);
    const totalChecks = await DatabaseService.getCheckCount();

    // Initialize default status if none exists
    if (!automationStatus) {
      const defaultStatus = await DatabaseService.upsertAutomationStatus({
        isRunning: true,
        searchNumber: "590698",
        nextCheck: getNextCronTime(),
      });

      return NextResponse.json({
        isRunning: defaultStatus.isRunning,
        searchNumber: defaultStatus.searchNumber,
        lastCheck: defaultStatus.lastCheck,
        nextCheck: defaultStatus.nextCheck,
        lastResult: defaultStatus.lastResult,
        checkHistory: recentChecks,
        totalChecks,
      });
    }

    return NextResponse.json({
      isRunning: automationStatus.isRunning,
      searchNumber: automationStatus.searchNumber,
      lastCheck: automationStatus.lastCheck,
      nextCheck: automationStatus.nextCheck,
      lastResult: automationStatus.lastResult,
      checkHistory: recentChecks,
      totalChecks,
    });
  } catch (error) {
    console.error("Failed to get automation status:", error);

    // Return default status on database error
    return NextResponse.json({
      isRunning: true,
      searchNumber: "590698",
      lastCheck: null,
      nextCheck: getNextCronTime(),
      lastResult: null,
      checkHistory: [],
      totalChecks: 0,
      error: "Database connection failed, showing default status",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, result } = body;

    if (action === "store-result") {
      // Store result from cron job
      if (result) {
        const checkResultData = {
          ...result,
          timestamp: new Date(result.timestamp),
          source: "cron" as const,
        };

        // Save to database
        const savedResult = await DatabaseService.addCheckResult(
          checkResultData
        );

        // Update automation status
        await DatabaseService.upsertAutomationStatus({
          isRunning: true,
          searchNumber: result.searchNumber || "590698",
          lastCheck: checkResultData.timestamp,
          nextCheck: getNextCronTime(),
          lastResult: savedResult,
        });

        return NextResponse.json({
          success: true,
          message: "Result stored successfully in MongoDB",
        });
      }
    } else if (action === "check-now") {
      // Perform manual check
      const searchNumber = "590698";
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      try {
        // Fetch PDF URL from embassy page
        const embassyResponse = await fetch(`${baseUrl}/api/scrape-embassy`);
        const embassyData = await embassyResponse.json();

        if (!embassyData.success) {
          throw new Error(`Failed to fetch embassy PDF: ${embassyData.error}`);
        }

        // Check PDF for the specific number
        const pdfResponse = await fetch(`${baseUrl}/api/pdf-checker`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfUrl: embassyData.pdfUrl,
            searchNumber,
          }),
        });

        const pdfResult = await pdfResponse.json();

        const checkResultData = {
          timestamp: new Date(),
          pdfUrl: embassyData.pdfUrl,
          searchNumber,
          found: pdfResult.found,
          matchCount: pdfResult.matchCount || 0,
          error: pdfResult.error || null,
          success: !pdfResult.error,
          emailSent: false,
          contexts: pdfResult.contexts || [],
          source: "manual" as const,
        };

        // Send email notification if number is found
        if (checkResultData.found) {
          try {
            const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "found",
                searchNumber,
                pdfUrl: embassyData.pdfUrl,
                matchCount: pdfResult.matchCount || 0,
                timestamp: checkResultData.timestamp.toISOString(),
                contexts: pdfResult.contexts || [],
              }),
            });

            if (emailResponse.ok) {
              console.log("✅ Manual check: Email notification sent");
              checkResultData.emailSent = true;
            }
          } catch (emailError) {
            console.error("❌ Email sending error:", emailError);
          }
        }

        // Save to database
        const savedResult = await DatabaseService.addCheckResult(
          checkResultData
        );

        // Update automation status
        await DatabaseService.upsertAutomationStatus({
          isRunning: true,
          searchNumber,
          lastCheck: checkResultData.timestamp,
          nextCheck: getNextCronTime(),
          lastResult: savedResult,
        });

        console.log(
          `✅ Manual check saved to MongoDB. Number ${searchNumber} found: ${checkResultData.found}`
        );

        return NextResponse.json({
          success: true,
          message: "Manual check completed and saved to MongoDB",
          result: savedResult,
        });
      } catch (checkError) {
        console.error("Error in manual check:", checkError);

        const errorResultData = {
          timestamp: new Date(),
          searchNumber,
          found: false,
          error:
            checkError instanceof Error ? checkError.message : "Unknown error",
          success: false,
          emailSent: false,
          source: "manual" as const,
        };

        // Save error to database
        const savedErrorResult = await DatabaseService.addCheckResult(
          errorResultData
        );

        // Update automation status with error
        await DatabaseService.upsertAutomationStatus({
          isRunning: true,
          searchNumber,
          lastCheck: errorResultData.timestamp,
          nextCheck: getNextCronTime(),
          lastResult: savedErrorResult,
        });

        return NextResponse.json(
          {
            success: false,
            error: errorResultData.error,
            result: savedErrorResult,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Automation API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process automation request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
