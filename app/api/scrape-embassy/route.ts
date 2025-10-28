import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET() {
  try {
    const url =
      "https://belgrad.diplo.de/rs-sr/service/2339474-2339474?openAccordionId=item-2728068-0-panel";

    // Fetch the webpage with comprehensive browser-like headers
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://belgrad.diplo.de/",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      console.error(
        `Embassy fetch failed: ${response.status} ${response.statusText}`
      );
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch webpage: ${response.status} ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for element with the specific title
    const targetElement = $(
      '[title="Abholliste/Lista za preuzimanje - Kneza Milosa 75"]'
    );

    if (targetElement.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not find element with title 'Abholliste/Lista za preuzimanje - Kneza Milosa 75'",
        },
        { status: 404 }
      );
    }

    // Extract href attribute
    const href = targetElement.attr("href");

    if (!href) {
      return NextResponse.json(
        { error: "Found element but no href attribute" },
        { status: 404 }
      );
    }

    // Convert relative URL to absolute URL if needed
    let pdfUrl = href;
    if (href.startsWith("/")) {
      pdfUrl = `https://belgrad.diplo.de${href}`;
    } else if (href.startsWith("./")) {
      pdfUrl = `https://belgrad.diplo.de/rs-sr/service/${href.substring(2)}`;
    } else if (!href.startsWith("http")) {
      pdfUrl = `https://belgrad.diplo.de/rs-sr/service/${href}`;
    }

    return NextResponse.json({
      success: true,
      pdfUrl: pdfUrl,
      originalHref: href,
      elementFound: true,
      message: "Successfully extracted PDF URL from embassy page",
    });
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to scrape embassy page",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { customUrl } = await request.json();

    if (!customUrl) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    // Fetch the webpage
    const response = await fetch(customUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch webpage: ${response.status} ${response.statusText}`,
        },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for element with the specific title
    const targetElement = $(
      '[title="Abholliste/Lista za preuzimanje - Kneza Milosa 75"]'
    );

    if (targetElement.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not find element with title 'Abholliste/Lista za preuzimanje - Kneza Milosa 75'",
        },
        { status: 404 }
      );
    }

    // Extract href attribute
    const href = targetElement.attr("href");

    if (!href) {
      return NextResponse.json(
        { error: "Found element but no href attribute" },
        { status: 404 }
      );
    }

    // Convert relative URL to absolute URL if needed
    let pdfUrl = href;
    const baseUrl = new URL(customUrl);
    if (href.startsWith("/")) {
      pdfUrl = `${baseUrl.origin}${href}`;
    } else if (href.startsWith("./")) {
      pdfUrl = `${baseUrl.origin}${baseUrl.pathname}/${href.substring(2)}`;
    } else if (!href.startsWith("http")) {
      pdfUrl = `${baseUrl.origin}${baseUrl.pathname}/${href}`;
    }

    return NextResponse.json({
      success: true,
      pdfUrl: pdfUrl,
      originalHref: href,
      elementFound: true,
      message: "Successfully extracted PDF URL",
    });
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      { error: "Failed to scrape webpage" },
      { status: 500 }
    );
  }
}
