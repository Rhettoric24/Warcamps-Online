# Warcamps Online - Server

The backend server for Warcamps Online multiplayer experience.

## Setup

### Prerequisites
- Node.js (v14 or higher) - [Download here](https://nodejs.org/)

### Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

You should see:
```
🎮 Warcamps Server Running
📍 Listening on http://localhost:3001
⚙️  Time Multiplier: 24x
🕐 Current Game Time: ...
```

## API Endpoints

### `GET /api/time`
Returns the current game time with full details.

**Response:**
```json
{
  "success": true,
  "gameMs": 86400000,
  "formatted": {
    "year": 1,
    "month": 1,
    "day": 2,
    "hour": 0,
    "minute": 0,
    "second": 0,
    "totalSeconds": 86400,
    "gameMs": 86400000
  },
  "serverRealTime": 1640000000000,
  "timeMultiplier": 24
}
```

### `GET /api/time/formatted`
Returns only the formatted game time (simpler for UI display).

**Response:**
```json
{
  "year": 1,
  "month": 1,
  "day": 2,
  "hour": 0,
  "minute": 0,
  "second": 0,
  "totalSeconds": 86400,
  "gameMs": 86400000
}
```

### `GET /api/status`
Health check endpoint.

**Response:**
```json
{
  "status": "online",
  "message": "Warcamps server is running",
  "uptime": 5000
}
```

## Time System

- **Time Multiplier**: 24x (game runs 24 times faster than real time)
- **1 real hour** = 1 game day
- **1 real day** ≈ 1 game month
- **1 real week** ≈ 1 game year

The server uses a centralized game clock that all players reference, preventing date/time manipulation.

## Development Notes

- The server maintains a single authoritative game clock
- All clients query this clock to stay in sync
- More features (database, notifications, WebSockets) will be added incrementally
