# Online PDF Number Checker

This is a [Next.js](https://nextjs.org) application that monitors PDF files from the German Embassy Belgrade website and automatically searches for specific numbers. When a number is found, it sends email notifications.

## ✨ Features

- � **Automated Monitoring**: Checks embassy PDFs 3 times daily (8:00, 12:00, 16:00) for number 59\*\*98
- 📧 **Email Notifications**: Automatic notifications to sa\*\*\*\*19@gmail.com when the number is found
- 🌐 **Manual PDF Search**: Search any PDF URL for specific numbers on demand
- � **MongoDB Persistence**: All checks and results stored in MongoDB Atlas
- �📱 **Real-time Status**: View automation status, last check, and next scheduled check
- � **Check History**: Track all automated checks with timestamps and results
- 🔄 **Client-Side Polling**: Browser triggers scheduled checks every 5 minutes
- 🌍 **PDF URL Caching**: Environment-aware system to handle embassy website blocking

## 🏗️ Architecture

### Scheduling System

- **Client-Side Polling**: Browser polls `/api/scheduled-check` every 5 minutes
- **MongoDB-Based Scheduling**: Checks run at 8:00, 12:00, and 16:00 daily
- **Environment-Aware**:
  - Local: Scrapes embassy website directly
  - Vercel: Uses cached PDF URL from MongoDB (embassy blocks Vercel IPs)

### Components

- **Server Component**: `page.tsx` (static, renders client components)
- **Client Components**:
  - `ManualCheck` - Manual PDF URL search with auto-fetch
  - `AutomaticMonitoring` - Automated checks with background polling
  - `PrintResults` - Reusable results display

### API Routes

- `/api/automation` - Manual "Check Now" functionality with environment-aware PDF fetching
- `/api/scheduled-check` - MongoDB-based scheduled checks
- `/api/pdf-url` - PDF URL caching (GET/POST)
- `/api/scrape-embassy` - Scrapes German Embassy website for PDF URL
- `/api/pdf-checker` - PDF text extraction and number search
- `/api/send-email` - Email notification service
- `/api/test-email` - Email configuration testing

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with:

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdf-checker?retryWrites=true&w=majority

# Email Configuration (Gmail App Password)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_character_app_password

# Scheduled Check Authentication
NEXT_PUBLIC_SCHEDULED_CHECK_SECRET=your-secret-key
```

### Email Setup

1. Go to [Google Account Settings](https://myaccount.google.com/apppasswords)
2. Generate a new App Password for "Mail"
3. Copy the 16-character password
4. Add to `.env.local` as `EMAIL_PASS`

### MongoDB Atlas Setup

1. Create account at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster
3. Create database user with read/write permissions
4. Whitelist IP: `0.0.0.0/0` (allow from anywhere)
5. Get connection string and add to `.env.local`

## 🚀 Getting Started

Install dependencies:

```bash
yarn install
# or
npm install
```

Run the development server:

```bash
yarn dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📦 Database Collections

### `automation` Collection

Stores automation status and cached PDF URL:

```typescript
{
  isRunning: boolean,
  searchNumber: string,
  lastCheck: Date,
  nextCheck: Date,
  lastResult: CheckResult,
  pdfUrl: string,           // Cached PDF URL
  pdfUrlUpdatedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### `check-history` Collection

Stores all check results:

```typescript
{
  timestamp: Date,
  pdfUrl: string,
  searchNumber: string,
  found: boolean,
  matchCount: number,
  error: string | undefined,
  success: boolean,
  emailSent: boolean,
  contexts: string[],
  source: 'manual' | 'scheduled',
  createdAt: Date
}
```

## 🌐 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel Dashboard:
   - `MONGODB_URI`
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `NEXT_PUBLIC_SCHEDULED_CHECK_SECRET`
3. Deploy

**Note**: Vercel Hobby plan limits:

- Max 2 cron jobs
- Cron jobs run max once per day
- Solution: Client-side polling used instead

### Important Notes

- **Embassy Website Blocking**: German Embassy website returns 401 on Vercel IPs
- **Solution**: PDF URL cached in MongoDB, updated locally when needed
- **To Update Cache**: Run "Check Now" locally to scrape and cache new PDF URL
- **Vercel Deployment**: Uses cached URL from MongoDB

## 🔍 How It Works

1. **Background Polling**: Browser polls every 5 minutes to trigger scheduled checks
2. **Scheduled Checks**: Run at 8:00, 12:00, 16:00 based on MongoDB scheduling logic
3. **PDF URL Fetching**:
   - **Local**: Scrapes embassy website directly
   - **Vercel**: Uses cached URL from MongoDB
4. **PDF Processing**: Downloads and extracts text using `pdf-extraction`
5. **Number Search**: Searches for number with context extraction
6. **Email**: Sends notification if number found
7. **Storage**: Saves all results to MongoDB

## 🛠️ Technology Stack

- **Framework**: Next.js 16.0.0 (App Router)
- **Database**: MongoDB Atlas
- **Deployment**: Vercel
- **Email**: Nodemailer (Gmail SMTP)
- **PDF Processing**: pdf-extraction
- **Web Scraping**: Cheerio
- **Styling**: Tailwind CSS

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [Vercel Deployment](https://vercel.com/docs)
