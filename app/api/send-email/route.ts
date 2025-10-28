import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Email configuration with explicit SMTP settings
const EMAIL_CONFIG = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || "burner.43910@gmail.com", // Gmail address
    pass: process.env.EMAIL_PASS || "weojjwypqyofjbgz", // App password
  },
  tls: {
    rejectUnauthorized: false,
  },
};

const RECIPIENT_EMAIL = "sale4319@gmail.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, searchNumber, pdfUrl, matchCount, timestamp, contexts } =
      body;

    // Validate required fields
    if (!type || !searchNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        "❌ Email credentials not configured in environment variables"
      );
      console.error(
        "Please set EMAIL_USER and EMAIL_PASS in your environment variables"
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Email service not configured - missing EMAIL_USER or EMAIL_PASS environment variables",
        },
        { status: 500 }
      );
    }

    console.log(`📧 Attempting to send ${type} email to ${RECIPIENT_EMAIL}`);
    console.log(`📧 Using sender email: ${process.env.EMAIL_USER}`);

    // Create transporter
    const transporter = nodemailer.createTransport(EMAIL_CONFIG);

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log("✅ Email transporter verified successfully");
    } catch (verifyError) {
      console.error("❌ Email transporter verification failed:", verifyError);
      return NextResponse.json(
        {
          success: false,
          error: `Email configuration invalid: ${
            verifyError instanceof Error ? verifyError.message : "Unknown error"
          }`,
        },
        { status: 500 }
      );
    }

    let subject, htmlContent, textContent;

    if (type === "found") {
      subject = `🎉 Number ${searchNumber} Found in Embassy PDF!`;

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #10B981; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">🎉 Great News!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your number has been found!</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #374151; margin-top: 0;">Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6B7280;">Search Number:</td>
                <td style="padding: 8px 0; color: #10B981; font-weight: bold; font-size: 18px;">${searchNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6B7280;">Matches Found:</td>
                <td style="padding: 8px 0;">${matchCount} occurrence(s)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6B7280;">Found At:</td>
                <td style="padding: 8px 0;">${new Date(
                  timestamp
                ).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6B7280;">PDF URL:</td>
                <td style="padding: 8px 0;">
                  <a href="${pdfUrl}" style="color: #3B82F6; text-decoration: none;">
                    View PDF Document
                  </a>
                </td>
              </tr>
            </table>
          </div>

          ${
            contexts && contexts.length > 0
              ? `
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #374151; margin-top: 0;">Context around matches:</h3>
            ${contexts
              .map(
                (context: string) => `
              <div style="background: white; padding: 12px; margin: 8px 0; border-radius: 4px; border-left: 4px solid #10B981;">
                <code style="font-family: monospace; color: #374151;">${context}</code>
              </div>
            `
              )
              .join("")}
          </div>
          `
              : ""
          }

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e;">
              <strong>Next Steps:</strong> Please visit the embassy or follow the instructions in the PDF document.
            </p>
          </div>

          <div style="text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px;">
            <p>This is an automated notification from your PDF monitoring service.</p>
            <p>Monitoring will continue to run as scheduled.</p>
          </div>
        </div>
      `;

      textContent = `
🎉 GREAT NEWS! Your number has been found!

Search Number: ${searchNumber}
Matches Found: ${matchCount} occurrence(s)
Found At: ${new Date(timestamp).toLocaleString()}
PDF URL: ${pdfUrl}

${
  contexts && contexts.length > 0
    ? `
Context around matches:
${contexts.join("\n---\n")}
`
    : ""
}

Next Steps: Please visit the embassy or follow the instructions in the PDF document.

This is an automated notification from your PDF monitoring service.
Monitoring will continue to run as scheduled.
      `;
    } else if (type === "error") {
      subject = `⚠️ PDF Monitoring Error for Number ${searchNumber}`;

      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #EF4444; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Monitoring Error</h1>
            <p style="margin: 10px 0 0 0;">There was an issue with your PDF monitoring.</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p><strong>Search Number:</strong> ${searchNumber}</p>
            <p><strong>Error Time:</strong> ${new Date(
              timestamp
            ).toLocaleString()}</p>
            <p><strong>Error:</strong> ${
              body.error || "Unknown error occurred"
            }</p>
          </div>

          <div style="text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px;">
            <p>Monitoring will attempt to continue automatically.</p>
            <p>If this error persists, please check the monitoring system.</p>
          </div>
        </div>
      `;

      textContent = `
⚠️ PDF Monitoring Error

Search Number: ${searchNumber}
Error Time: ${new Date(timestamp).toLocaleString()}
Error: ${body.error || "Unknown error occurred"}

Monitoring will attempt to continue automatically.
If this error persists, please check the monitoring system.
      `;
    } else {
      return NextResponse.json(
        { error: "Invalid email type" },
        { status: 400 }
      );
    }

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: RECIPIENT_EMAIL,
      subject,
      text: textContent,
      html: htmlContent,
    };

    const emailResult = await transporter.sendMail(mailOptions);

    console.log(
      `✅ Email sent successfully to ${RECIPIENT_EMAIL} for ${type} notification`
    );
    console.log(`📧 Message ID: ${emailResult.messageId}`);

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${RECIPIENT_EMAIL}`,
      type,
    });
  } catch (error) {
    console.error("Email sending error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send email notification",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Email notification service",
    recipient: RECIPIENT_EMAIL,
    configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
  });
}
