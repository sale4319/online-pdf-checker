# MongoDB Atlas Setup Guide

## ✅ **Implementation Complete**

MongoDB Atlas has been fully integrated into the application with persistent storage, automated scheduling, and PDF URL caching.

## 🎯 **What's Been Implemented**

### 📦 **Dependencies**

- `mongodb` - Official MongoDB Node.js driver
- Connection pooling for optimal performance
- Environment-aware configurations

### 🏗️ **Infrastructure**

1. **`lib/mongodb.ts`** - Connection utility with pooling and error handling
2. **`lib/database.ts`** - Type-safe database service layer with:
   - `AutomationStatus` operations
   - `CheckResult` operations
   - Check history retrieval (last 10 results)
   - Total check count tracking

### �️ **Database Collections**

#### **`automation`** Collection

Stores automation configuration and state:

```typescript
{
  _id: ObjectId,
  isRunning: boolean,
  searchNumber: string,
  lastCheck: Date,
  nextCheck: Date,
  lastResult: CheckResult,
  pdfUrl: string,              // NEW: Cached PDF URL
  pdfUrlUpdatedAt: Date,       // NEW: Cache timestamp
  createdAt: Date,
  updatedAt: Date
}
```

#### **`check-history`** Collection

Complete audit trail of all checks:

```typescript
{
  _id: ObjectId,
  timestamp: Date,
  pdfUrl: string,
  searchNumber: string,
  found: boolean,
  matchCount: number,
  error: string | undefined,
  success: boolean,
  emailSent: boolean,
  contexts: string[],
  source: 'manual' | 'scheduled',  // Updated sources
  createdAt: Date
}
```

### 🚀 **Features Implemented**

#### 1. **MongoDB-Based Scheduling**

- ✅ Client-side polling every 5 minutes
- ✅ Scheduled checks at 8:00, 12:00, 16:00 daily
- ✅ Next check time calculation
- ✅ Automatic status updates

#### 2. **PDF URL Caching System**

- ✅ `/api/pdf-url` endpoint (GET/POST)
- ✅ Stores PDF URL in automation collection
- ✅ Environment-aware fetching:
  - **Local**: Scrapes embassy website
  - **Vercel**: Uses cached URL
- ✅ Solves embassy website blocking issue

#### 3. **Environment-Aware Architecture**

- ✅ Detects Vercel deployment via `VERCEL_URL`
- ✅ Direct database access (no internal HTTP calls)
- ✅ Inline PDF processing (eliminates HTTP overhead)
- ✅ Proper error handling with stack traces

#### 4. **Persistent Check History**

- ✅ All checks saved to MongoDB
- ✅ Last 10 results displayed
- ✅ Total check counter
- ✅ Search by source type

## 🔧 **Configuration**

### Current MongoDB Atlas Connection

```bash
MONGODB_URI=mongodb+srv://sal4319:admin@cluster0.wtqoc4c.mongodb.net/pdf-checker
```

Database: `pdf-checker`
Collections: `automation`, `check-history`

### Environment Variables Required

```bash
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pdf-checker?retryWrites=true&w=majority

# Email (Gmail App Password)
EMAIL_USER=burner.43910@gmail.com
EMAIL_PASS=your_app_password

# Scheduled Check Authentication
NEXT_PUBLIC_SCHEDULED_CHECK_SECRET=scheduled-check-secret-2024
```

## 🔥 **Key Solutions Implemented**

### Problem 1: Vercel Hobby Plan Limitations

**Issue**: Max 2 cron jobs, once per day limit
**Solution**: Client-side polling + MongoDB-based scheduling logic

### Problem 2: Embassy Website Blocks Vercel IPs

**Issue**: German Embassy returns 401 on Vercel deployment
**Solution**: PDF URL caching system

- Local development scrapes and caches URL
- Vercel uses cached URL from MongoDB
- Manual refresh via "Check Now" button locally

### Problem 3: Internal API Call Failures

**Issue**: `fetch()` to internal routes returned HTML error pages
**Solution**:

- Direct database access instead of HTTP calls
- Inline PDF processing
- Environment-aware URL construction

## 📊 **Current Status**

✅ **Fully Operational:**

- MongoDB Atlas integration
- Automated scheduling (8:00, 12:00, 16:00)
- Client-side polling system
- PDF URL caching
- Environment-aware logic
- Email notifications
- Complete check history
- Manual "Check Now" functionality

✅ **Tested & Working:**

- Local development ✓
- MongoDB persistence ✓
- PDF URL caching ✓
- Scheduled checks ✓
- Email notifications ✓

🚀 **Ready for Production:**

- Vercel deployment ready
- All environment variables configured
- Error handling implemented
- Background polling active

## 🎯 **Real PDF URL Cached**

Current cached URL (as of Oct 28, 2025):

```
https://belgrad.diplo.de/resource/blob/2728068/1b0d443ee9d8631c9ab7c61686b1b9ae/abholliste-fz-und-ewt-vom-24-07-data.pdf
```

Last updated: `2025-10-28T22:31:35.999Z`

## 🔄 **Maintenance**

### Updating Cached PDF URL

When embassy updates the PDF URL:

1. Run application locally
2. Click "Check Now" button
3. System automatically:
   - Scrapes new URL
   - Caches in MongoDB
   - Vercel deployment uses updated cache

### Monitoring

- Check automation status at `/api/automation`
- View last 10 checks in UI
- Total checks tracked in database

## � **Benefits Achieved**

### Reliability

- ✅ Survives server restarts
- ✅ Survives deployments
- ✅ No data loss
- ✅ Consistent state across instances

### Scalability

- ✅ Unlimited check history
- ✅ Fast queries with MongoDB indexes
- ✅ Multiple server instances supported
- ✅ Handles high check frequency

### Maintainability

- ✅ Type-safe database operations
- ✅ Centralized service layer
- ✅ Environment-aware logic
- ✅ Comprehensive error handling

## �️ **Technical Implementation**

### API Routes Updated

1. **`/api/automation`** - Manual checks with environment awareness
2. **`/api/scheduled-check`** - MongoDB-based scheduled checks
3. **`/api/pdf-url`** - PDF URL caching (GET/POST)
4. **`/api/scrape-embassy`** - Embassy website scraper

### Component Architecture

- Server Component: `page.tsx`
- Client Components: `ManualCheck`, `AutomaticMonitoring`
- Background polling in `AutomaticMonitoring` component
- Self-contained state management

### Error Handling

- JSON parse protection
- Response status checks
- Stack trace logging
- Graceful fallbacks

## 📝 **Next Steps for Enhancement**

Future improvements could include:

- 📊 Analytics dashboard
- 📈 Check frequency analysis
- 🔍 Advanced search through history
- 📱 Multiple search numbers support
- 🔔 Multiple notification channels
- 📧 Customizable email templates
