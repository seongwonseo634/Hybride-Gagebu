# App State & Rules

## Current Features
- **CSV Data Sync**: Supports fuzzy header mapping and robust progress tracking.
- **AI Financial Report**: Analyzes transactions, assets, and budgets to provide actionable advice.
- **Inferred Intelligence**: Automatically detects recurring payments and estimates net worth even if dedicated collections are not yet populated.
- **Mobile First**: Built for mobile view with a bottom navigation bar.

## Infrastructure
- **Frontend**: React + Vite + Tailwind CSS.
- **Backend**: Express + Vite Middleware + GEMINI API.
- **Database**: Firebase Firestore (Auth guided by ModeContext).

## Key Paths
- `/src/pages/ReportPage.tsx`: Main analytics and AI advice.
- `/src/pages/SettingsPage.tsx`: Data import/export and diagnostics.
- `/server.ts`: Gemini API proxy.

## Constraints
- Use common libraries like `lucide-react`, `recharts`, `framer-motion`.
- Always proxy sensitive API calls through `/api/*`.
- Maintain glassmorphism design language using the `neo` and `neo-inset` utility classes.
