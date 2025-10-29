import { NextRequest, NextResponse } from "next/server";
import extract from "pdf-extraction";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfUrl, searchNumber } = body;

    // Validate inputs
    if (!pdfUrl) {
      return NextResponse.json(
        { error: "No PDF URL provided" },
        { status: 400 }
      );
    }

    if (!searchNumber) {
      return NextResponse.json(
        { error: "No search number provided" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(pdfUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid PDF URL provided" },
        { status: 400 }
      );
    }

    // Fetch PDF from URL
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch PDF from URL" },
        { status: 400 }
      );
    }

    // Check if the response is a PDF
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/pdf")) {
      return NextResponse.json(
        { error: "URL does not point to a PDF file" },
        { status: 400 }
      );
    }

    // Convert response to buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const pdfData = await extract(buffer);
    const fullText = pdfData.text; // Search for the specific number
    const searchRegex = new RegExp(
      searchNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi"
    );
    const matches = fullText.match(searchRegex);
    const found = matches && matches.length > 0;

    // Get context around matches (optional: show surrounding text)
    const contexts: string[] = [];
    if (found && matches) {
      const lines = fullText.split("\n");
      lines.forEach((line: string, index: number) => {
        if (searchRegex.test(line)) {
          // Get context: previous line, current line, next line
          const context = [
            lines[index - 1]?.trim() || "",
            line.trim(),
            lines[index + 1]?.trim() || "",
          ]
            .filter(Boolean)
            .join(" ... ");
          contexts.push(context);
        }
      });
    }

    return NextResponse.json({
      found,
      searchNumber,
      matchCount: matches ? matches.length : 0,
      contexts: contexts.slice(0, 10), // Limit to first 10 contexts
      pdfUrl: pdfUrl,
      fileSize: buffer.length,
      totalPages: pdfData.pages?.length || "Unknown",
    });
  } catch (error) {
    console.error("PDF processing error:", error);
    return NextResponse.json(
      { error: "Failed to process PDF file" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "PDF Checker API",
      usage:
        "POST a JSON body with pdfUrl and searchNumber parameters to search for specific numbers in a PDF from URL",
      example: {
        pdfUrl: "https://example.com/document.pdf",
        searchNumber: "12345",
      },
    },
    { status: 200 }
  );
}
