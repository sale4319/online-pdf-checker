# Online PDF Number Checker

This is a [Next.js](https://nextjs.org) application that monitors PDF files from the German Embassy Belgrade website and automatically searches for specific numbers. When a number is found, it sends email notifications.

## Features

- 🔍 **Automated PDF Monitoring**: Checks embassy PDFs every 4 hours for number 590698
- 📧 **Email Notifications**: Sends notifications to sale4319@gmail.com when the number is found
- 🌐 **Manual Search**: Search any PDF URL for specific numbers
- 📱 **Real-time Status**: View automation status with collapsible details
- 📊 **Check History**: Track all automated checks with timestamps and results

## Email Configuration

To enable email notifications, you need to set up Gmail credentials:

1. Copy `.env.example` to `.env.local`
2. Set up Gmail App Password:
   - Go to [Google Account Settings](https://myaccount.google.com/apppasswords)
   - Generate a new App Password for "Mail"
   - Copy the 16-character password
3. Update your `.env.local` file:
   ```bash
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_PASS=your_16_character_app_password
   ```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
