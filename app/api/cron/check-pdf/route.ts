import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "../../../../lib/database";

export async function GET(request: NextRequest) {
  try {
    // Verify this is actually a cron request (Vercel sets specific headers)
    const cronSecret = request.headers.get("authorization");
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🕒 Cron job triggered - performing automated PDF check...");

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
      console.error("❌ Failed to fetch embassy PDF:", embassyData.error);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch embassy PDF: ${embassyData.error}`,
        timestamp: new Date().toISOString(),
      });
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
          searchNumber: "590698", // Hard-coded as requested
        }),
      }
    );

    const pdfResult = await pdfResponse.json();

    const checkResult = {
      timestamp: new Date().toISOString(),
      pdfUrl: embassyData.pdfUrl,
      searchNumber: "590698",
      found: pdfResult.found,
      matchCount: pdfResult.matchCount || 0,
      error: pdfResult.error || null,
      success: !pdfResult.error,
      emailSent: false,
    };

    console.log(
      `📊 Cron check completed. Number 590698 found: ${checkResult.found}`
    );

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
              searchNumber: "590698",
              pdfUrl: embassyData.pdfUrl,
              matchCount: pdfResult.matchCount || 0,
              timestamp: checkResult.timestamp,
              contexts: pdfResult.contexts || [],
            }),
          }
        );

        if (emailResponse.ok) {
          console.log("✅ Email notification sent successfully");
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

    // Store the result directly in MongoDB
    try {
      const checkResultData = {
        timestamp: new Date(checkResult.timestamp),
        pdfUrl: checkResult.pdfUrl,
        searchNumber: checkResult.searchNumber,
        found: checkResult.found,
        matchCount: checkResult.matchCount,
        error: checkResult.error,
        success: checkResult.success,
        emailSent: checkResult.emailSent,
        contexts: [],
        source: "cron" as const,
      };

      // Save to database
      const savedResult = await DatabaseService.addCheckResult(checkResultData);

      // Calculate next cron time (daily at 12:00)
      const now = new Date();
      const nextRun = new Date(now);

      const cronHour = 12;

      if (now.getHours() >= cronHour) {
        // Already past today's run, schedule for tomorrow
        nextRun.setDate(nextRun.getDate() + 1);
      }

      nextRun.setHours(cronHour, 0, 0, 0);

      // Update automation status
      await DatabaseService.upsertAutomationStatus({
        isRunning: true,
        searchNumber: checkResult.searchNumber,
        lastCheck: checkResultData.timestamp,
        nextCheck: nextRun,
        lastResult: savedResult,
      });

      console.log("✅ Cron result saved to MongoDB successfully");
    } catch (storeError) {
      console.error("❌ Failed to store cron result in MongoDB:", storeError);
    }

    return NextResponse.json({
      success: true,
      message: "Cron check completed successfully",
      result: checkResult,
    });
  } catch (error) {
    console.error("❌ Cron job error:", error);

    const errorResult = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
      emailSent: false,
    };

    // Try to store the error result in MongoDB
    try {
      const errorResultData = {
        timestamp: new Date(errorResult.timestamp),
        searchNumber: "590698",
        found: false,
        error: errorResult.error,
        success: false,
        emailSent: false,
        source: "cron" as const,
      };

      await DatabaseService.addCheckResult(errorResultData);
      console.log("✅ Cron error saved to MongoDB");
    } catch (storeError) {
      console.error("❌ Failed to store cron error in MongoDB:", storeError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        result: errorResult,
      },
      { status: 500 }
    );
  }
}
