# August

An AI-powered agent management and task automation platform. August enables users to run and manage autonomous AI agents, handle task execution, and coordinate with various services through both desktop and web interfaces.

## Features

- **Agent Management** - Run and manage autonomous AI agents with built-in permission systems
- **Task Execution** - Create, track, and execute tasks with AI agent assistance
- **Real-time Sync** - Rocicorp Zero for live bidirectional data synchronization
- **Multi-platform** - Desktop app (Electron) and web app with shared codebase
- **Third-party Integrations** - Connect external services via Composio
- **Auto-updates** - Built-in update mechanism for the desktop application

## Project Structure

```
august/
├── apps/
│   ├── shell/          # Electron desktop application
│   ├── app/            # Vite + React web application
│   ├── website/        # Next.js marketing website
│   ├── server/         # Express.js backend API
│   ├── db/             # Database setup and migrations
│   └── zero-cache/     # Rocicorp Zero sync service
├── packages/
│   ├── shell-tools/    # Agent tools (grep with ripgrep)
│   ├── sync/           # Database queries and mutations
│   ├── shared/         # Shared types and IPC system
│   ├── typescript-config/
│   └── eslint-config/
└── docs/               # Architecture documentation
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, TanStack Router, Tailwind CSS 4, Radix UI |
| Desktop | Electron 37+, Electron Builder |
| Backend | Node.js, Express.js, PostgreSQL, Drizzle ORM |
| Sync | Rocicorp Zero, Better-sqlite3 (client cache) |
| Auth | Clerk |
| AI | AI SDK, OpenAI, Anthropic Claude |
| Build | Turborepo, npm workspaces |

## Prerequisites

- Node.js >= 18
- npm 10.9.2+
- Docker (for local PostgreSQL)

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd august

# Install dependencies
npm install

# Build all packages
npm run build
```

### Development

```bash
# Start all apps in development mode
npm run dev

# Or start specific apps
npx turbo dev --filter=app      # Web app only
npx turbo dev --filter=shell    # Desktop app only
npx turbo dev --filter=server   # Backend only
```

### Database Setup

```bash
cd apps/db

# Start PostgreSQL in Docker
npm run dev:db-up

# Run migrations
npm run migrate

# Stop PostgreSQL
npm run dev:db-down
```

### Building for Production

```bash
# Build all packages
npm run build

# Build desktop app for specific platforms
cd apps/shell
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run build` | Build all apps and packages |
| `npm run lint` | Run ESLint across the monorepo |
| `npm run format` | Format code with Prettier |
| `npm run check-types` | TypeScript type checking |

## Apps

### Shell (`apps/shell`)

Electron desktop application that serves as the container for the web app. Handles:
- Local agent execution
- IPC communication with the renderer
- System-level integrations
- Auto-updates

### App (`apps/app`)

Main React web application running inside Electron or standalone. Features:
- Task management interface
- Agent interaction UI
- Settings and configuration
- PWA support via Serwist

### Server (`apps/server`)

Express.js backend running on port 8080. Provides:
- REST API endpoints
- Authentication via Clerk
- Billing via DodoPayments
- Webhook handlers
- Third-party integrations

### Website (`apps/website`)

Next.js marketing website with landing pages and public documentation.

## Packages

### @jupiter/shared

Shared TypeScript types and IPC system for type-safe communication between Electron main and renderer processes.

### @jupiter/sync

Database queries, mutations, and Rocicorp Zero schema definitions. Used by both client and server for data synchronization.

### @jupiter/shell-tools

Agent tools including a ripgrep-based grep utility for fast file content searching.

## Architecture

### IPC System

Three-layer architecture for Electron communication:
1. **Shared types** in `@jupiter/shared`
2. **Main process handlers** in `apps/shell/src/main/ipc/`
3. **Preload scripts** exposing `window.api`

See `docs/ipc.md` for detailed documentation.

### Data Synchronization

Uses Rocicorp Zero for real-time bidirectional sync:
- Server-side schema in `@jupiter/sync`
- Client-side SQLite cache via better-sqlite3
- Zero-cache service for sync coordination

## Environment Variables

Each app requires its own `.env` file. Key variables include:

- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_*` - Clerk authentication keys
- `OPENAI_API_KEY` - OpenAI API key
- `COMPOSIO_API_KEY` - Composio integration key
- `DODO_*` - DodoPayments billing keys

## Contributing

1. Create a feature branch from `development`
2. Make your changes
3. Run `npm run lint` and `npm run check-types`
4. Submit a pull request

## License

Proprietary - All rights reserved
