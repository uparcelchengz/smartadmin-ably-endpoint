# SmartAdmin Dashboard

A Next.js dashboard application for monitoring and controlling multiple Ably clients in real-time with persistent logging to MongoDB.

## Features

- **Real-time Client Monitoring**: View all connected clients with live status updates
- **Client Cards**: Each client displayed as a card with key information:
  - Hostname, IP address, timezone
  - Platform, app version, uptime
  - Memory usage
  - Online/offline status
- **Quick Actions**: Ping and get status directly from client cards
- **Detailed Client View**: Click on any client to see:
  - Full client information
  - Control panel with commands (ping, get-status, restart, shutdown)
  - Chat-like message log showing all sent and received messages
  - Custom command input for advanced control
- **Activity Logs**: Complete history of all connections and messages stored in MongoDB
  - View all client connections with timestamps and durations
  - Search and filter messages by client, type, or command
  - Export logs to JSON
- **Dark Mode**: Toggle between light and dark themes
- **Live Updates**: Automatic updates via Ably presence and status channels

## Tech Stack

- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **Ably Realtime** for WebSocket communication
- **MongoDB** with Mongoose ODM for persistent logging
- **Lucide React** for icons
- **shadcn/ui** for UI components

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- MongoDB instance (local or MongoDB Atlas)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file in the root directory:

```env
MONGODB_URI=mongodb://localhost:27017/smartadmin
```

For MongoDB Atlas, use:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/smartadmin?retryWrites=true&w=majority
```

3. Start MongoDB (if running locally):
```bash
# On Windows with MongoDB installed
mongod

# On macOS with Homebrew
brew services start mongodb-community

# On Linux
sudo systemctl start mongodb
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard page
│   ├── logs/
│   │   └── page.tsx                # Activity logs page
│   ├── client/[id]/
│   │   └── page.tsx                # Client detail page
│   ├── api/
│   │   └── logs/
│   │       ├── connection/
│   │       │   └── route.ts        # Connection logging API
│   │       └── message/
│   │           └── route.ts        # Message logging API
│   └── layout.tsx
├── components/
│   ├── client-card.tsx             # Client card component
│   ├── theme-toggle.tsx            # Dark mode toggle
│   └── ui/                         # UI components (Button, Card, Badge, Input)
├── lib/
│   ├── ably-client.ts              # Ably client singleton
│   ├── mongodb.ts                  # MongoDB connection
│   └── utils.ts                    # Utility functions
├── models/
│   ├── ClientConnection.ts         # Mongoose connection schema
│   └── Message.ts                  # Mongoose message schema
└── types/
    └── client.ts                   # TypeScript type definitions
```

## Database Schema

### ClientConnection
- `clientId`: Unique client identifier
- `hostname`: Client hostname
- `clientIP`: Client IP address
- `timezone`: Client timezone
- `platform`: Operating system/platform
- `appVersion`: Application version
- `connectedAt`: Connection timestamp
- `disconnectedAt`: Disconnection timestamp
- `status`: online | offline
- `connectionDuration`: Total connection time in ms

### Message
- `clientId`: Client identifier
- `type`: sent | received
- `channel`: Ably channel name
- `command`: Command name
- `payload`: Message data (JSON)
- `timestamp`: Message timestamp

## API Routes

### POST /api/logs/connection
Create a new connection log
```json
{
  "clientId": "smartadmin-|-hostname-|-12345",
  "hostname": "MY-COMPUTER",
  "clientIP": "192.168.1.100",
  "timezone": "Asia/Singapore",
  "platform": "win32",
  "appVersion": "1.0.0",
  "status": "online"
}
```

### PATCH /api/logs/connection
Update connection status (on disconnect)
```json
{
  "clientId": "smartadmin-|-hostname-|-12345",
  "status": "offline"
}
```

### GET /api/logs/connection
Query connections with filters:
- `limit`: Number of results (default: 50)
- `skip`: Pagination offset
- `clientId`: Filter by client ID
- `status`: Filter by status (online|offline)

### POST /api/logs/message
Create a new message log
```json
{
  "clientId": "smartadmin-|-hostname-|-12345",
  "type": "sent",
  "channel": "smartadmin-control-clientId",
  "command": "ping",
  "payload": {}
}
```

### GET /api/logs/message
Query messages with filters:
- `limit`: Number of results (default: 100)
- `skip`: Pagination offset
- `clientId`: Filter by client ID
- `type`: Filter by message type (sent|received)
- `command`: Filter by command name
- `startDate`: Filter messages after this date
- `endDate`: Filter messages before this date

## Ably Channels

The dashboard uses the following Ably channels:

- `smartadmin-presence`: Tracks online/offline client presence
- `smartadmin-status`: Receives status updates from clients
- `smartadmin-control-broadcast`: Sends commands to all clients
- `smartadmin-control-{clientId}`: Sends commands to specific clients

## Commands

The dashboard can send the following commands to clients:

- **ping**: Check if client is responsive
- **get-status**: Request full client status
- **restart**: Restart the client application
- **shutdown**: Shutdown the client application
- **execute-action**: Execute a custom action script (future feature)

## Client Integration

Clients should implement the following:

1. Connect to Ably with a unique `clientId`
2. Enter the `smartadmin-presence` channel with client metadata
3. Subscribe to `smartadmin-control-broadcast` and `smartadmin-control-{clientId}` channels
4. Send heartbeat and status updates to `smartadmin-status` channel
5. Respond to commands received on control channels

## Customization

### Ably API Key

Update the Ably API key in `src/lib/ably-client.ts`:

```typescript
const ablyInstance = new Ably.Realtime({
  key: "YOUR_ABLY_API_KEY",
  clientId: "smartadmin-dashboard"
});
```

### Adding New Commands

1. Add the command type to `src/types/client.ts`
2. Create a button in the control panel component
3. Handle the command response in the message log
4. Logging is automatic via the API routes

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Deployment Notes

When deploying to production:

1. Ensure MongoDB is accessible from your deployment environment
2. Set the `MONGODB_URI` environment variable in your hosting platform
3. For MongoDB Atlas, whitelist your deployment server's IP address
4. Consider adding authentication to the API routes for security
5. Enable MongoDB indexes for optimal query performance (automatically created by Mongoose)

## License

MIT
