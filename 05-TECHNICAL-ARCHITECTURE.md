# ShiftPro — Technical Architecture

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Desktop Web  │  │  Mobile PWA  │  │  iCal Clients │          │
│  │  (React/Vite) │  │  (React/Vite)│  │ (Google/Apple)│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          │    HTTPS / WSS   │                  │ HTTPS (read-only)
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RAILWAY.COM                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │         Static Frontend (Vite Build)         │                │
│  │         + Caddy/Nginx reverse proxy          │                │
│  └─────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE                                   │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Auth    │  │  PostgREST   │  │   Realtime   │              │
│  │  (JWT)    │  │  (REST API)  │  │  (WebSocket) │              │
│  └──────────┘  └──────────────┘  └──────────────┘              │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │          Edge Functions (Deno)                │               │
│  │  ┌────────────┐ ┌──────────────┐             │               │
│  │  │  Business   │ │  Scheduled   │             │               │
│  │  │  Logic FNs  │ │  Cron Jobs   │             │               │
│  │  └────────────┘ └──────────────┘             │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐                                 │
│  │ Storage  │  │  PostgreSQL  │                                  │
│  │ (S3)     │  │  + PostGIS   │                                  │
│  └──────────┘  │  + pg_cron   │                                  │
│                └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Frontend Architecture

### 2.1 Project Structure

```
shiftpro-web/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (Vite PWA generates)
│   ├── icons/                 # PWA icons (192, 512)
│   └── favicon.ico
├── src/
│   ├── main.tsx               # App entry point
│   ├── App.tsx                # Root component with routing
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client init
│   │   ├── auth.ts            # Auth helpers
│   │   ├── api.ts             # Edge Function call helpers
│   │   ├── realtime.ts        # Realtime subscription helpers
│   │   └── utils.ts           # Date formatting, timezone helpers
│   ├── hooks/
│   │   ├── useAuth.ts         # Auth state hook
│   │   ├── useOrganization.ts # Org context hook
│   │   ├── useRealtime.ts     # Generic realtime subscription hook
│   │   ├── useNotifications.ts
│   │   └── useGeolocation.ts  # GPS capture hook
│   ├── stores/                # Zustand or React Context stores
│   │   ├── authStore.ts
│   │   ├── scheduleStore.ts
│   │   └── notificationStore.ts
│   ├── components/
│   │   ├── ui/                # shadcn/ui base components
│   │   ├── layout/
│   │   │   ├── AppShell.tsx   # Main layout (sidebar + content)
│   │   │   ├── Sidebar.tsx    # Navigation sidebar
│   │   │   ├── TopBar.tsx     # Top bar (search, notifications, user menu)
│   │   │   └── ChatWidget.tsx # Slide-out messaging panel
│   │   ├── schedule/
│   │   │   ├── ScheduleEditor.tsx    # Main schedule editor grid
│   │   │   ├── ShiftCell.tsx         # Individual shift block
│   │   │   ├── ShiftModal.tsx        # Create/edit shift dialog
│   │   │   ├── ScheduleToolbar.tsx   # Filters, view toggles, tools
│   │   │   ├── ScheduleFooter.tsx    # Hours/cost summary row
│   │   │   ├── OpenShiftRow.tsx      # Open shifts row
│   │   │   ├── TeamSchedule.tsx      # Read-only team view
│   │   │   ├── MySchedule.tsx        # Employee's personal schedule
│   │   │   └── AvailabilityGrid.tsx  # Availability overview
│   │   ├── attendance/
│   │   │   ├── TimeClock.tsx         # Clock in/out widget
│   │   │   ├── TimesheetList.tsx     # Timesheet table
│   │   │   ├── TimesheetSummary.tsx  # Aggregated view
│   │   │   └── TimeEntryModal.tsx    # Manual time entry
│   │   ├── timeoff/
│   │   │   ├── TimeOffRequestList.tsx
│   │   │   ├── TimeOffCalendar.tsx
│   │   │   ├── TimeOffRequestForm.tsx
│   │   │   └── BalancesView.tsx
│   │   ├── employees/
│   │   │   ├── EmployeeList.tsx
│   │   │   ├── EmployeeProfile.tsx
│   │   │   ├── EmployeeForm.tsx
│   │   │   └── InviteModal.tsx
│   │   ├── messaging/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── ContactList.tsx
│   │   ├── tasks/
│   │   │   ├── MyTasks.tsx
│   │   │   ├── ChecklistView.tsx
│   │   │   ├── ChecklistTemplateEditor.tsx
│   │   │   └── TaskAssignmentModal.tsx
│   │   ├── policies/
│   │   │   ├── PolicyList.tsx
│   │   │   ├── PolicyViewer.tsx
│   │   │   ├── PolicyUploadModal.tsx
│   │   │   └── AcknowledgmentTracker.tsx
│   │   ├── reports/
│   │   │   ├── ReportShell.tsx       # Common report layout
│   │   │   ├── ScheduledHoursReport.tsx
│   │   │   ├── WorkedHoursReport.tsx
│   │   │   ├── ScheduledVsActualReport.tsx
│   │   │   ├── AttendanceReport.tsx
│   │   │   ├── TimeOffReport.tsx
│   │   │   └── AuditLogReport.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── WhosWorking.tsx
│   │   │   ├── PendingApprovals.tsx
│   │   │   ├── UpcomingShifts.tsx
│   │   │   └── MyTasksWidget.tsx
│   │   ├── settings/
│   │   │   ├── SettingsLayout.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── ScheduleSettings.tsx
│   │   │   ├── PositionSettings.tsx
│   │   │   ├── JobSiteSettings.tsx
│   │   │   ├── SkillSettings.tsx
│   │   │   ├── BreakSettings.tsx
│   │   │   ├── AccessLevelSettings.tsx
│   │   │   ├── TimeOffPolicySettings.tsx
│   │   │   ├── BlockedDaySettings.tsx
│   │   │   ├── HolidaySettings.tsx
│   │   │   ├── TimeClockSettings.tsx
│   │   │   ├── PayRuleSettings.tsx
│   │   │   └── BrandingSettings.tsx
│   │   └── notifications/
│   │       ├── NotificationBell.tsx
│   │       └── NotificationCenter.tsx
│   ├── pages/                 # Route-level page components
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── EmployeesPage.tsx
│   │   ├── ScheduleEditorPage.tsx
│   │   ├── TeamSchedulePage.tsx
│   │   ├── MySchedulePage.tsx
│   │   ├── AvailabilityPage.tsx
│   │   ├── RequestsPage.tsx
│   │   ├── TimeOffPage.tsx
│   │   ├── BalancesPage.tsx
│   │   ├── TimesheetsPage.tsx
│   │   ├── MyTimesheetsPage.tsx
│   │   ├── PayrollPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── MessagesPage.tsx
│   │   ├── TasksPage.tsx
│   │   ├── PoliciesPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── NotFoundPage.tsx
│   └── types/
│       ├── database.ts        # Generated from Supabase (supabase gen types)
│       ├── api.ts             # Edge Function request/response types
│       └── ui.ts              # UI-specific types
├── supabase/
│   ├── config.toml            # Supabase project config
│   ├── migrations/            # SQL migration files (numbered)
│   │   ├── 001_extensions.sql
│   │   ├── 002_enums.sql
│   │   ├── 003_core_tables.sql
│   │   ├── 004_junction_tables.sql
│   │   ├── 005_scheduling.sql
│   │   ├── 006_attendance.sql
│   │   ├── 007_timeoff.sql
│   │   ├── 008_messaging.sql
│   │   ├── 009_tasks_policies.sql
│   │   ├── 010_notifications.sql
│   │   ├── 011_audit.sql
│   │   ├── 012_rls_policies.sql
│   │   ├── 013_functions_triggers.sql
│   │   └── 014_seed.sql
│   └── functions/             # Edge Functions
│       ├── create-organization/index.ts
│       ├── invite-employee/index.ts
│       ├── bulk-import-employees/index.ts
│       ├── publish-schedule/index.ts
│       ├── create-shift/index.ts
│       ├── copy-previous-week/index.ts
│       ├── apply-template/index.ts
│       ├── handle-shift-request/index.ts
│       ├── clock-action/index.ts
│       ├── approve-timesheets/index.ts
│       ├── request-timeoff/index.ts
│       ├── handle-timeoff-request/index.ts
│       ├── run-timeoff-accruals/index.ts
│       ├── generate-task-instances/index.ts
│       ├── create-ad-hoc-task/index.ts
│       ├── upload-policy-version/index.ts
│       ├── generate-report/index.ts
│       ├── ical-feed/index.ts
│       └── _shared/            # Shared utilities
│           ├── cors.ts
│           ├── auth.ts
│           ├── notifications.ts
│           ├── audit.ts
│           └── validation.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── .env.example
```

### 2.2 Key Frontend Dependencies

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "@supabase/supabase-js": "^2",
    "zustand": "^4",
    "date-fns": "^3",
    "date-fns-tz": "^3",
    "@tanstack/react-query": "^5",
    "tailwindcss": "^3",
    "@radix-ui/react-*": "various",
    "lucide-react": "^0.400",
    "react-dnd": "^16",
    "react-dnd-html5-backend": "^16",
    "zod": "^3",
    "react-hook-form": "^7",
    "@hookform/resolvers": "^3",
    "recharts": "^2",
    "papaparse": "^5",
    "vite-plugin-pwa": "^0.20"
  }
}
```

### 2.3 State Management Strategy

| State Type | Tool | Examples |
|-----------|------|---------|
| Server state (cached data) | TanStack Query | Employee list, shifts, timesheets |
| Auth state | Zustand + Supabase Auth listener | Current user, JWT, role |
| UI state | React useState/useReducer | Modal open/close, selected filters |
| Real-time state | Supabase Realtime + Zustand | Notifications, messages, presence |
| Form state | React Hook Form + Zod | All forms |

### 2.4 Routing Structure

```typescript
/                          → Redirect to /dashboard
/login                     → LoginPage
/signup                    → SignupPage (org creation)
/dashboard                 → DashboardPage
/employees                 → EmployeesPage
/employees/:id             → EmployeeProfile
/schedule/editor           → ScheduleEditorPage
/schedule/team             → TeamSchedulePage
/schedule/mine             → MySchedulePage
/schedule/availability     → AvailabilityPage
/schedule/requests         → RequestsPage (tabs: swaps, offers, drops)
/timeoff                   → TimeOffPage (requests list)
/timeoff/balances          → BalancesPage
/timesheets                → TimesheetsPage
/timesheets/mine           → MyTimesheetsPage
/payroll                   → PayrollPage
/reports/:type             → ReportsPage (dynamic by report type)
/messages                  → MessagesPage (full-page messaging)
/tasks                     → TasksPage
/tasks/templates           → ChecklistTemplateEditor
/policies                  → PoliciesPage
/settings/:section         → SettingsPage (dynamic section)
```

## 3. Deployment Architecture

### 3.1 Railway.com Configuration

Railway hosts the frontend static build and any auxiliary services.

**Service: `shiftpro-web`**
- Type: Static site (Dockerfile with Nginx/Caddy)
- Build: `npm run build` (Vite produces `dist/` folder)
- Domain: Custom domain via Railway (e.g., `app.shiftpro.com`)
- SSL: Automatic via Railway
- Environment variables injected at build time

**Dockerfile (frontend)**:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM caddy:2-alpine
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
```

**Caddyfile**:
```
:80 {
    root * /srv
    file_server
    try_files {path} /index.html
    header {
        X-Frame-Options DENY
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Content-Security-Policy "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' https://*.supabase.co blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
    }
    encode gzip
}
```

### 3.2 Supabase Configuration

- **Project**: Create a Supabase project (hosted or self-hosted)
- **Database**: PostgreSQL 15+ with PostGIS, pg_trgm, pg_cron extensions
- **Auth**: Email/password provider enabled. Custom JWT claims hook configured.
- **Edge Functions**: Deployed via `supabase functions deploy`
- **Storage**: Buckets created for avatars, policies, exports, org-assets
- **Realtime**: Enabled on relevant tables (notifications, messages, shifts, clock_events)

### 3.3 Environment Variables

**Frontend (.env)**:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://app.shiftpro.com
```

**Supabase Edge Functions (secrets)**:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Admin key for Edge Functions
SUPABASE_ANON_KEY=eyJ...
```

## 4. PWA Configuration

### 4.1 Manifest

```json
{
  "name": "ShiftPro",
  "short_name": "ShiftPro",
  "description": "Workforce management platform",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#3B82F6",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 4.2 Service Worker Strategy

- **Navigation**: Network-first (always try to load latest app shell)
- **Static assets**: Cache-first (CSS, JS bundles, images)
- **API responses**: Network-first with cache fallback for: current week's shifts, employee list, own profile
- **Offline page**: Show cached schedule data with "offline" indicator banner

### 4.3 Vite PWA Plugin Config

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: { /* ... */ },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxAgeSeconds: 300 }
            }
          }
        ]
      }
    })
  ]
})
```

## 5. Security Architecture

### 5.1 Authentication

- Supabase Auth handles user management, password hashing (bcrypt), and JWT issuance
- JWTs contain custom claims: `organization_id`, `user_role`
- Access tokens expire after 1 hour; refresh tokens auto-rotate
- Password requirements: min 8 chars, must include letter + number

### 5.2 Authorization

- **Database level**: Row-Level Security (RLS) policies on every table
- **Edge Function level**: Functions verify JWT and check role before processing
- **Frontend level**: Route guards redirect unauthorized users; UI hides unavailable actions

### 5.3 Data Protection

- All traffic over HTTPS (Railway + Supabase enforce this)
- No sensitive data in URL parameters
- File uploads scanned for size limits (max 10MB per file)
- SQL injection prevented by parameterized queries (Supabase client handles this)
- XSS prevented by React's default escaping + CSP headers
- CSRF not applicable (JWT in Authorization header, not cookies)

### 5.4 Audit Trail

- All sensitive operations logged in `audit_logs` table
- Logs include: actor, action, entity, changes (diff), IP address, timestamp
- Audit logs are append-only (no update/delete RLS policy)
- Retained for 2 years minimum

## 6. Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Schedule editor render (50 employees, week view) | < 500ms |
| API response (list queries) | < 200ms |
| Realtime message delivery | < 1s |
| Lighthouse Performance score | > 90 |
| PWA install prompt eligible | Yes |

## 7. Monitoring & Observability

- **Error tracking**: Sentry (frontend errors + Edge Function errors)
- **Uptime monitoring**: Railway built-in health checks + external (e.g., Better Uptime)
- **Database monitoring**: Supabase Dashboard (query performance, connection pool, storage)
- **Logging**: Supabase Edge Function logs (accessible via dashboard and CLI)
- **Analytics**: Simple page-view tracking via lightweight analytics (Plausible or PostHog, optional)

## 8. CI/CD Pipeline

```
GitHub Repository
    │
    ├── Push to main → GitHub Actions
    │   ├── Run TypeScript type check
    │   ├── Run ESLint
    │   ├── Run unit tests (Vitest)
    │   ├── Build frontend (Vite)
    │   ├── Deploy to Railway (production)
    │   └── Deploy Edge Functions (supabase functions deploy)
    │
    └── Push to dev → GitHub Actions
        ├── Same checks as above
        ├── Deploy to Railway (staging)
        └── Deploy Edge Functions to staging Supabase project
```

### GitHub Actions Workflow Example

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      # Railway auto-deploys from GitHub, or use Railway CLI
      - uses: supabase/setup-cli@v1
      - run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## 9. Database Migrations Strategy

- Migrations are SQL files in `supabase/migrations/` directory
- Numbered sequentially: `001_extensions.sql`, `002_enums.sql`, etc.
- Applied via `supabase db push` (development) or `supabase db migrate` (CI/CD)
- Seed data for development in `supabase/seed.sql`
- TypeScript types auto-generated: `supabase gen types typescript --project-id X > src/types/database.ts`
