# FluxMod Frontend

A modern, professional React-based dashboard for managing FluxMod AutoMod rules and settings.

## Features

- **React 18** with modern hooks and patterns
- **Chakra UI** for professional, accessible components
- **Light & Dark Mode** - Full theme support with system preference detection
- **Responsive Design** - Works on desktop, tablet, and mobile
- **OAuth Integration** - Secure Fluxer authentication
- **Real-time Stats** - Live guild count, uptime, and commit activity
- **Dev Mode** - Local development without OAuth (set `VITE_DEV_MODE=true`)

## Tech Stack

- React 18 + Vite
- Chakra UI + Framer Motion
- React Router DOM
- React Icons

## Color Scheme

The professional color palette uses:

- **Primary**: Brand Blue (#0ea5e9 to #0284c7)
- **Accent**: Emerald Green (#22c55e to #16a34a) 
- **Danger**: Red for destructive actions
- **Warning**: Amber for caution states
- **Slate**: Professional grays for neutrals

Both light and dark modes are fully supported.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run locally:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Preview production build:
```bash
npm run preview
```

## Development Mode

To bypass OAuth during local development:

```bash
VITE_DEV_MODE=true npm run dev
```

This will use mock user data instead of requiring Fluxer authentication.

## Project Structure

```
src/
  components/     # Reusable UI components
  context/        # React context providers
  hooks/          # Custom React hooks
  pages/          # Page components
  theme/          # Chakra UI theme config
  utils/          # Helper functions and API
```

## Pages

- `/` - Home/Landing page with stats and features
- `/pages/dashboard.html` - Guild selection dashboard
- `/pages/guild-dashboard.html` - Guild AutoMod management
- `/pages/contributors.html` - Project contributors
- `/pages/terms.html` - Terms of Service
- `/pages/privacy.html` - Privacy Policy
- `/pages/status.html` - HTTP status pages

## API Integration

The frontend connects to the FluxMod backend API:

- `GET /api/me` - Current user info
- `GET /api/guilds` - User's guilds
- `GET /api/guilds/{id}/rules` - Guild AutoMod rules
- `POST /api/guilds/{id}/rules` - Create rule
- `PUT /api/guilds/{id}/rules/{ruleId}` - Update rule
- `DELETE /api/guilds/{id}/rules/{ruleId}` - Delete rule
- `POST /api/guilds/{id}/rules/{ruleId}/toggle` - Enable/disable rule
- `GET /api/guilds/{id}/settings` - Guild settings
- `PUT /api/guilds/{id}/settings` - Update settings

## License

ISC
