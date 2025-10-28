import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST() {
  try {
    console.log("🧪 Testing email configuration...");

    // Check environment variables
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    console.log(`📧 EMAIL_USER: ${emailUser ? "✅ Set" : "❌ Not set"}`);
    console.log(`🔐 EMAIL_PASS: ${emailPass ? "✅ Set" : "❌ Not set"}`);

    if (!emailUser || !emailPass) {
      return NextResponse.json({
        success: false,
        error: "Missing email credentials",
        details: {
          EMAIL_USER: emailUser ? "Set" : "Missing",
          EMAIL_PASS: emailPass ? "Set" : "Missing",
        },
      });
    }

    // Test transporter with explicit SMTP settings
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log("🔍 Verifying transporter...");
    await transporter.verify();
    console.log("✅ Transporter verification successful");

    // Send test email
    const testEmail = {
      from: emailUser,
      to: "sale4319@gmail.com",
      subject: "🧪 PDF Monitoring Test Email",
      text: "This is a test email from your PDF monitoring system. If you receive this, email notifications are working correctly!",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #10B981;">🧪 Test Email Successful!</h2>
          <p>Your PDF monitoring email system is configured correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>From:</strong> ${emailUser}</p>
          <p><strong>To:</strong> sale4319@gmail.com</p>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p><strong>Next:</strong> Your automated monitoring will send notifications to this email when number 590698 is found.</p>
          </div>
        </div>
      `,
    };

    console.log("📤 Sending test email...");
    const result = await transporter.sendMail(testEmail);
    console.log(
      `✅ Test email sent successfully! Message ID: ${result.messageId}`
    );

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully",
      details: {
        messageId: result.messageId,
        from: emailUser,
        to: "sale4319@gmail.com",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Test email failed:", error);

    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: "Email test failed",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Email Test Endpoint",
    usage: "POST to this endpoint to test email configuration",
    note: "Make sure EMAIL_USER and EMAIL_PASS are set in environment variables",
  });
}
