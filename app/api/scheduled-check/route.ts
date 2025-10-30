import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "../../../lib/database";
import extract from "pdf-extraction";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for this function

// Calculate next scheduled check time (8:00, 12:00, or 16:00)
function getNextScheduledTime(): Date {
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

export async function GET(request: NextRequest) {
  try {
    // Check authentication - allow both Vercel cron and client-side polling
    const authHeader = request.headers.get("authorization");
    const userAgent = request.headers.get("user-agent") || "";
    const isVercelCron = userAgent.includes("vercel-cron");

    const expectedSecret =
      process.env.SCHEDULED_CHECK_SECRET ||
      process.env.NEXT_PUBLIC_SCHEDULED_CHECK_SECRET;

    // Allow Vercel cron or authenticated requests
    if (!isVercelCron && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(
      `🔍 Scheduled check triggered... (source: ${
        isVercelCron ? "Vercel Cron" : "Client Polling"
      })`
    );

    // Get automation status from database
    const automationStatus = await DatabaseService.getAutomationStatus();

    if (!automationStatus) {
      console.log("⚠️ No automation status found, initializing...");
      const nextCheck = getNextScheduledTime();
      await DatabaseService.upsertAutomationStatus({
        isRunning: true,
        searchNumber: "590698",
        nextCheck,
      });
    }

    // If called by Vercel Cron, always run the check (it's already scheduled at 12:00 and 16:00)
    // If called manually, check if it's time based on MongoDB scheduling
    const now = new Date();
    const shouldRunCheck =
      isVercelCron ||
      (automationStatus?.nextCheck &&
        now >= new Date(automationStatus.nextCheck));

    if (!shouldRunCheck) {
      const nextCheck = automationStatus?.nextCheck
        ? new Date(automationStatus.nextCheck)
        : getNextScheduledTime();
      const minutesUntilNext = Math.round(
        (nextCheck.getTime() - now.getTime()) / 60000
      );
      console.log(`⏰ Next check scheduled in ${minutesUntilNext} minutes`);
      return NextResponse.json({
        success: true,
        message: "Not yet time for check",
        nextCheck: nextCheck.toISOString(),
        minutesUntilNext,
      });
    }

    console.log("✅ Performing scheduled PDF check...");

    const searchNumber = "590698";
    let pdfUrl: string;

    try {
      // On Vercel, use cached URL from database since scraping is blocked
      // Locally, try scraping first
      if (process.env.VERCEL_URL) {
        // Running on Vercel - get cached URL directly from database
        console.log(
          "Running on Vercel, fetching cached PDF URL from database..."
        );
        const cachedStatus = await DatabaseService.getAutomationStatus();

        if (!cachedStatus?.pdfUrl) {
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

        pdfUrl = cachedStatus.pdfUrl;
        console.log("✅ Using cached PDF URL from database");
      } else {
        // Running locally - scrape the embassy page
        console.log("Running locally, scraping embassy page...");
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

      // Check PDF directly to avoid HTTP call issues
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

      const now = new Date();
      const checkResult = {
        timestamp: now,
        pdfUrl,
        searchNumber,
        found: pdfResult.found,
        matchCount: pdfResult.matchCount || 0,
        error: undefined,
        success: true,
        emailSent: false,
        contexts: pdfResult.contexts || [],
        source: "scheduled" as const,
      };

      console.log(
        `📊 Check completed. Number ${searchNumber} found: ${checkResult.found}`
      );

      // Send email notification if number is found
      if (checkResult.found) {
        try {
          const emailUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}/api/send-email`
            : "http://localhost:3000/api/send-email";

          const emailResponse = await fetch(emailUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "found",
              searchNumber,
              pdfUrl,
              matchCount: pdfResult.matchCount || 0,
              timestamp: checkResult.timestamp.toISOString(),
              contexts: pdfResult.contexts || [],
            }),
          });

          if (emailResponse.ok) {
            console.log("✅ Email notification sent successfully");
            checkResult.emailSent = true;
          } else {
            console.error("❌ Failed to send email notification");
          }
        } catch (emailError) {
          console.error("❌ Email sending error:", emailError);
        }
      }

      // Save to database
      const savedResult = await DatabaseService.addCheckResult(checkResult);

      // Schedule next check at 8:00, 12:00, or 16:00
      const nextCheck = getNextScheduledTime();

      // Update automation status
      await DatabaseService.upsertAutomationStatus({
        isRunning: true,
        searchNumber,
        lastCheck: checkResult.timestamp,
        nextCheck,
        lastResult: savedResult,
      });

      console.log(
        `✅ Scheduled check complete. Next check at ${nextCheck.toISOString()}`
      );

      return NextResponse.json({
        success: true,
        message: "Scheduled check completed",
        result: checkResult,
        nextCheck: nextCheck.toISOString(),
      });
    } catch (fetchError) {
      console.error("❌ Failed to fetch PDF URL:", fetchError);

      // Save error result
      await DatabaseService.addCheckResult({
        timestamp: new Date(),
        searchNumber,
        found: false,
        error:
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to fetch PDF URL",
        success: false,
        emailSent: false,
        source: "scheduled",
      });

      // Schedule next check at 8:00, 12:00, or 16:00
      const next = getNextScheduledTime();

      await DatabaseService.upsertAutomationStatus({
        isRunning: true,
        searchNumber,
        lastCheck: now,
        nextCheck: next,
      });

      return NextResponse.json({
        success: false,
        error:
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to fetch PDF URL",
      });
    }
  } catch (error) {
    console.error("❌ Scheduled check error:", error);

    // Try to save error result
    try {
      await DatabaseService.addCheckResult({
        timestamp: new Date(),
        searchNumber: "590698",
        found: false,
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
        emailSent: false,
        source: "scheduled",
      });
    } catch (saveError) {
      console.error("❌ Failed to save error result:", saveError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
