import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "../../../lib/database";

// Calculate next scheduled check time (8:00, 12:00, or 16:00)
function getNextCronTime(): Date {
  const now = new Date();
  const nextRun = new Date(now);

  const scheduledHours = [8, 12, 16];
  const currentHour = now.getHours();

  // Find next scheduled hour today
  let nextHour = scheduledHours.find((h) => h > currentHour);

  if (nextHour === undefined) {
    // No more runs today, schedule for first run tomorrow
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(scheduledHours[0], 0, 0, 0);
  } else {
    nextRun.setHours(nextHour, 0, 0, 0);
  }

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

      // Construct base URL for internal API calls
      const protocol = process.env.VERCEL_URL ? "https" : "http";
      const host = process.env.VERCEL_URL || "localhost:3000";
      const baseUrl = `${protocol}://${host}`;

      try {
        let pdfUrl: string;

        // On Vercel, use cached URL first since scraping is blocked
        // Locally, try scraping first
        if (process.env.VERCEL_URL) {
          // Running on Vercel - use cached URL
          console.log("Running on Vercel, checking for cached PDF URL...");
          const pdfUrlResponse = await fetch(`${baseUrl}/api/pdf-url`);
          const pdfUrlData = await pdfUrlResponse.json();

          if (pdfUrlData.success && pdfUrlData.pdfUrl) {
            pdfUrl = pdfUrlData.pdfUrl;
            console.log("✅ Using cached PDF URL from database");
          } else {
            throw new Error(
              "No cached PDF URL found. Please run 'Check Now' locally first to cache the URL, or use Manual PDF Check to set it."
            );
          }
        } else {
          // Running locally - scrape the embassy page
          console.log("Running locally, scraping embassy page...");
          const embassyResponse = await fetch(`${baseUrl}/api/scrape-embassy`);

          if (!embassyResponse.ok) {
            throw new Error(
              `Embassy scraping failed with status ${embassyResponse.status}`
            );
          }

          const embassyData = await embassyResponse.json();

          if (!embassyData.success || !embassyData.pdfUrl) {
            throw new Error("Failed to extract PDF URL from embassy page");
          }

          pdfUrl = embassyData.pdfUrl;
          console.log("✅ Fetched PDF URL via scraping:", pdfUrl);

          // Cache the PDF URL for Vercel
          try {
            await fetch(`${baseUrl}/api/pdf-url`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pdfUrl }),
            });
            console.log("✅ Cached PDF URL in database");
          } catch (cacheError) {
            console.log("⚠️ Could not cache PDF URL:", cacheError);
          }
        }

        // Check PDF for the specific number
        const pdfResponse = await fetch(`${baseUrl}/api/pdf-checker`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfUrl,
            searchNumber,
          }),
        });

        if (!pdfResponse.ok) {
          throw new Error(
            `PDF checker API returned status ${pdfResponse.status}`
          );
        }

        const pdfResult = await pdfResponse.json();

        const checkResultData = {
          timestamp: new Date(),
          pdfUrl,
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
                pdfUrl,
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
