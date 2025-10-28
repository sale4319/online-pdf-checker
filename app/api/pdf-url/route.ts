import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "../../../lib/database";

export const dynamic = "force-dynamic";

// Get the stored PDF URL
export async function GET() {
  try {
    const automationStatus = await DatabaseService.getAutomationStatus();

    if (!automationStatus?.pdfUrl) {
      return NextResponse.json({
        success: false,
        error:
          "No PDF URL stored in database. Please set it using POST request.",
      });
    }

    return NextResponse.json({
      success: true,
      pdfUrl: automationStatus.pdfUrl,
      lastUpdated: automationStatus.pdfUrlUpdatedAt,
    });
  } catch (error) {
    console.error("Error fetching PDF URL:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch PDF URL from database",
      },
      { status: 500 }
    );
  }
}

// Update the stored PDF URL
export async function POST(request: NextRequest) {
  try {
    const { pdfUrl } = await request.json();

    if (!pdfUrl || typeof pdfUrl !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a valid PDF URL",
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(pdfUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid URL format",
        },
        { status: 400 }
      );
    }

    // Update automation status with new PDF URL
    await DatabaseService.upsertAutomationStatus({
      pdfUrl,
      pdfUrlUpdatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "PDF URL updated successfully",
      pdfUrl,
    });
  } catch (error) {
    console.error("Error updating PDF URL:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update PDF URL in database",
      },
      { status: 500 }
    );
  }
}
