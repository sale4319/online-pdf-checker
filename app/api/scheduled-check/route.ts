import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "../../../lib/database";

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
    // Simple authentication - you can use a secret token
    const authHeader = request.headers.get("authorization");
    const expectedSecret =
      process.env.SCHEDULED_CHECK_SECRET ||
      process.env.NEXT_PUBLIC_SCHEDULED_CHECK_SECRET;

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔍 Scheduled check triggered...");

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

    // Check if it's time to run
    const now = new Date();
    const nextCheck = automationStatus?.nextCheck
      ? new Date(automationStatus.nextCheck)
      : now;

    if (now < nextCheck) {
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

    console.log("✅ Time to check! Performing automated PDF check...");

    const searchNumber = "590698";

    // Construct base URL for internal API calls
    const protocol = process.env.VERCEL_URL ? "https" : "http";
    const host = process.env.VERCEL_URL || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    // Fetch PDF URL from embassy page
    const embassyResponse = await fetch(`${baseUrl}/api/scrape-embassy`);
    const embassyData = await embassyResponse.json();

    if (!embassyData.success) {
      console.error("❌ Failed to fetch embassy PDF:", embassyData.error);

      // Save error result
      await DatabaseService.addCheckResult({
        timestamp: new Date(),
        searchNumber,
        found: false,
        error: `Failed to fetch embassy PDF: ${embassyData.error}`,
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
        error: `Failed to fetch embassy PDF: ${embassyData.error}`,
      });
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

    const checkResult = {
      timestamp: now,
      pdfUrl: embassyData.pdfUrl,
      searchNumber,
      found: pdfResult.found,
      matchCount: pdfResult.matchCount || 0,
      error: pdfResult.error || null,
      success: !pdfResult.error,
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
        const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "found",
            searchNumber,
            pdfUrl: embassyData.pdfUrl,
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

    // Save the result
    const savedResult = await DatabaseService.addCheckResult(checkResult);

    // Calculate next scheduled check time (8:00, 12:00, or 16:00)
    const nextCheckTime = getNextScheduledTime();

    await DatabaseService.upsertAutomationStatus({
      isRunning: true,
      searchNumber,
      lastCheck: now,
      nextCheck: nextCheckTime,
      lastResult: savedResult,
    });

    console.log(
      `✅ Result saved. Next check scheduled for ${nextCheckTime.toISOString()}`
    );

    return NextResponse.json({
      success: true,
      message: "Scheduled check completed",
      result: checkResult,
      nextCheck: nextCheckTime.toISOString(),
    });
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
