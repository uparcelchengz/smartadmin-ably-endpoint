# Ably Webhook Implementation

This implementation allows your SmartAdmin dashboard to automatically save Ably messages to PostgreSQL **even when the website is not open**. This is crucial for production environments where you need to capture all messages regardless of whether users are actively using the dashboard.

## 🎯 Problem Solved

**Before**: Messages were only saved when someone was actively using the dashboard (client-side auto-logging).

**After**: Messages are automatically saved to PostgreSQL via server-side webhooks, ensuring 100% message capture.

## 🚀 Features Implemented

### 1. Webhook Endpoint (`/api/webhooks/ably`)
- **Purpose**: Receives webhook calls directly from Ably
- **Functionality**: Automatically processes and saves messages to PostgreSQL
- **Channels**: Monitors `smartadmin-*` channels (status updates, control commands)
- **Persistence**: Works 24/7 regardless of dashboard usage

### 2. Background Sync (`/api/background/sync-messages`)
- **Purpose**: Fallback mechanism using Ably's history API
- **Functionality**: Syncs missed messages periodically
- **Triggering**: Manual or scheduled via cron jobs
- **Safety**: Prevents data loss if webhooks fail

### 3. Setup & Monitoring Dashboard (`/webhook-setup`)
- **Purpose**: Easy webhook configuration and monitoring
- **Features**: 
  - Real-time message statistics
  - Manual sync triggers
  - Webhook testing
  - Configuration instructions

### 4. Cron Job Support (`/api/cron/sync-messages`)
- **Purpose**: Scheduled background synchronization
- **Authentication**: Bearer token security
- **Frequency**: Can be set to run every few minutes

## 📋 Setup Instructions

### Step 1: Environment Configuration

Add these variables to your `.env.local`:

```bash
# Ably Configuration
ABLY_API_KEY=j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU

# Webhook Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
WEBHOOK_URL=http://localhost:3000/api/webhooks/ably

# Cron Job Security
CRON_SECRET=smartadmin-cron-secret-2024
```

### Step 2: Configure Ably Webhooks

1. Go to [Ably Dashboard](https://ably.com/dashboard)
2. Select your app → Settings → Webhooks
3. Create new webhook with these settings:
   - **URL**: `https://your-domain.com/api/webhooks/ably`
   - **Events**: `channel.message` ✓
   - **Channel Filter**: `^smartadmin-.*`
   - **Request Mode**: `batch`
   - **Format**: `json`

### Step 3: Test the Setup

1. Visit `/webhook-setup` in your dashboard
2. Click "Test Webhook Endpoint"
3. Trigger a background sync to verify functionality
4. Check message statistics

## 🔧 API Endpoints

### Webhook Endpoint
```
POST /api/webhooks/ably
```
- Receives webhook payloads from Ably
- Processes and saves messages to PostgreSQL
- Returns processing statistics

### Background Sync
```
POST /api/background/sync-messages  # Trigger sync
GET /api/background/sync-messages   # Get stats
```
- Syncs historical messages using Ably History API
- Returns sync results and message counts

### Setup & Config
```
GET /api/webhooks/setup    # Get configuration info
POST /api/webhooks/setup   # Test webhook/trigger actions
```
- Provides setup instructions
- Allows testing webhook functionality

### Cron Job
```
GET /api/cron/sync-messages?authorization=Bearer TOKEN
```
- Scheduled sync endpoint for external cron services
- Requires authentication via Bearer token

## 🗄️ Database Schema

Messages are stored in the `message_logs` table:

```sql
CREATE TABLE message_logs (
  message_id VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- 'sent' or 'received'
  channel VARCHAR(255) NOT NULL,
  command VARCHAR(255) NOT NULL,
  payload JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## 📊 Message Types Captured

### Status Messages (Received)
- **Channel**: `smartadmin-status`
- **Type**: `received`
- **Commands**: `ping`, `status-update`, `heartbeat`, etc.
- **Source**: Clients reporting their status

### Control Messages (Sent)
- **Channel**: `smartadmin-control-broadcast`
- **Type**: `sent`  
- **Commands**: `ping`, `restart`, `shutdown`, etc.
- **Target**: Commands sent to clients

## ⚡ Production Recommendations

### 1. Use Webhooks as Primary Method
- Set up Ably webhooks for real-time message capture
- Most reliable approach with minimal latency

### 2. Implement Background Sync as Backup
- Set up a cron job to run background sync every 5-10 minutes
- Catches any messages missed by webhooks

### 3. Monitor the System
- Check `/webhook-setup` dashboard regularly
- Monitor webhook delivery logs in Ably dashboard
- Set up alerts for failed webhook deliveries

### 4. Environment Variables for Production
```bash
# Update for your production domain
NEXT_PUBLIC_SITE_URL=https://your-domain.com
WEBHOOK_URL=https://your-domain.com/api/webhooks/ably

# Use a strong random secret for cron jobs
CRON_SECRET=your-secure-random-secret-here
```

## 🔍 Troubleshooting

### Webhooks Not Working
1. Check webhook configuration in Ably dashboard
2. Verify webhook URL is accessible from internet
3. Check server logs for webhook processing errors
4. Test webhook endpoint manually

### Missing Messages
1. Trigger manual background sync
2. Check Ably history for missed messages
3. Verify database connectivity
4. Check message logs table for duplicates

### Database Issues
1. Verify PostgreSQL connection string
2. Check table exists and schema is correct
3. Ensure database user has write permissions

## 📈 Monitoring & Analytics

The webhook setup dashboard provides:
- Total message counts
- Last message timestamp  
- Sync operation results
- Real-time testing capabilities

## 🔒 Security Considerations

1. **Webhook Authentication**: Consider implementing webhook signature verification
2. **Cron Secret**: Use strong, random secrets for cron job endpoints
3. **Database Access**: Use least-privilege database credentials
4. **Environment Variables**: Never commit secrets to version control

This implementation ensures your SmartAdmin system captures 100% of messages for reliable monitoring and control of your Ably clients!