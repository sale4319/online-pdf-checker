import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "../../../lib/database";
import extract from "pdf-extraction";

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
    const { action } = body;

    if (action === "check-now") {
      // Perform manual check
      const searchNumber = "590698";

      try {
        let pdfUrl: string;

        // On Vercel, use cached URL first since scraping is blocked
        // Locally, try scraping first
        if (process.env.VERCEL_URL) {
          // Running on Vercel - use cached URL directly from database
          console.log("Running on Vercel, checking for cached PDF URL...");
          const automationStatus = await DatabaseService.getAutomationStatus();

          if (!automationStatus?.pdfUrl) {
            console.error("No cached PDF URL found in database");
            return NextResponse.json(
              {
                success: false,
                error:
                  "No cached PDF URL found. Please run 'Check Now' locally first to cache the PDF URL.",
              },
              { status: 500 }
            );
          }

          pdfUrl = automationStatus.pdfUrl;
          console.log("Using cached PDF URL:", pdfUrl);
        } else {
          // Running locally - scrape the embassy page
          console.log("Running locally, scraping embassy page...");

          // For local calls, we can use relative URLs
          const embassyResponse = await fetch(
            `http://localhost:3000/api/scrape-embassy`
          );

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

          // Cache the PDF URL for Vercel to use
          try {
            await DatabaseService.upsertAutomationStatus({
              isRunning: true,
              searchNumber,
              pdfUrl,
              pdfUrlUpdatedAt: new Date(),
            });
            console.log("✅ Cached PDF URL in database");
          } catch (cacheError) {
            console.log("⚠️ Could not cache PDF URL:", cacheError);
          }
        }

        // Check PDF for the specific number - do it directly to avoid HTTP call issues
        console.log("Fetching and checking PDF...");
        const pdfResponse = await fetch(pdfUrl);

        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
        }

        const arrayBuffer = await pdfResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const data = await extract(buffer);
        const text = data.text || "";

        // Search for the number in the PDF
        const searchPattern = new RegExp(searchNumber, "gi");
        const matches = text.match(searchPattern);
        const found = matches !== null && matches.length > 0;
        const matchCount = matches ? matches.length : 0;

        // Extract context around matches
        const contexts: string[] = [];
        if (found && matches) {
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.includes(searchNumber)) {
              contexts.push(line.trim());
            }
          }
        }

        const pdfResult = {
          found,
          matchCount,
          contexts: contexts.slice(0, 5), // Limit to 5 contexts
        };

        const checkResultData = {
          timestamp: new Date(),
          pdfUrl,
          searchNumber,
          found: pdfResult.found,
          matchCount: pdfResult.matchCount || 0,
          error: undefined,
          success: true,
          emailSent: false,
          contexts: pdfResult.contexts || [],
          source: "manual" as const,
        };

        // Send email notification if number is found
        if (checkResultData.found) {
          try {
            // Call email API (this will work on both local and Vercel)
            const emailBody = {
              type: "found",
              searchNumber,
              pdfUrl,
              matchCount: pdfResult.matchCount || 0,
              timestamp: checkResultData.timestamp.toISOString(),
              contexts: pdfResult.contexts || [],
            };

            // For Vercel, we need to use the external URL
            const emailUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}/api/send-email`
              : "http://localhost:3000/api/send-email";

            const emailResponse = await fetch(emailUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(emailBody),
            });

            if (emailResponse.ok) {
              console.log("✅ Manual check: Email notification sent");
              checkResultData.emailSent = true;
            } else {
              console.log(
                "⚠️ Email API returned:",
                emailResponse.status,
                await emailResponse.text()
              );
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
            details: checkError instanceof Error ? checkError.stack : undefined,
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
