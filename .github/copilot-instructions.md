# SmartAdmin Dashboard - Copilot Instructions

This is a Next.js dashboard application for monitoring and controlling multiple Ably clients.

## Project Overview
- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS with shadcn/ui components
- **Real-time Communication**: Ably Realtime for client monitoring and control
- **Features**: Client cards, detail views, message logs, control commands

## Development Guidelines
- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use server components where possible, client components for interactivity
- Implement proper error handling for Ably connections
- Keep components modular and reusable

## Project Structure
- `/app` - Next.js app router pages and layouts
- `/components` - Reusable UI components
- `/lib` - Utility functions and Ably client setup
- `/types` - TypeScript type definitions

## Key Features to Implement
1. Client monitoring with real-time status updates
2. Client detail view with message logs
3. Command control panel (ping, restart, etc.)
4. Quick actions on client cards
