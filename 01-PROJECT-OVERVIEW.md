# ShiftPro — Project Overview

## 1. What Is This Project?

ShiftPro is a workforce management platform built as a modern, open-source alternative to Zoho Shifts. It targets service-industry businesses (restaurants, pet care, retail, hospitality) that need employee scheduling, time tracking, messaging, and task management in a single tool.

The platform will replicate the core feature set of Zoho Shifts — scheduling, attendance, time-off, timesheets, reporting, and messaging — while adding a **Tasks & Policies** module that Zoho Shifts lacks. This module lets managers create reusable checklists tied to shifts or roles, and publish company policies with version tracking and employee acknowledgment.

## 2. Target User Profile

| Attribute | Detail |
|-----------|--------|
| **Business Size** | 50–500 employees across 3–20 physical locations |
| **Industries** | Pet care, restaurants, retail, hospitality, clinics |
| **User Roles** | Admin (owner/ops), Manager (location-level), Employee |
| **Primary Device** | Employees: mobile (PWA). Managers/Admins: desktop + mobile |

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Database & Auth** | Supabase (PostgreSQL + Auth + Realtime + Storage) | Managed Postgres with built-in auth, realtime subscriptions, row-level security, and file storage. Eliminates need for separate auth service and reduces infrastructure complexity. |
| **Backend / API** | Supabase Edge Functions (Deno/TypeScript) | Serverless functions co-located with the database. TypeScript keeps the stack unified. No servers to manage. |
| **Frontend** | React + TypeScript (Vite) | Industry standard. PWA-capable via Vite PWA plugin. Large ecosystem for UI components. |
| **Hosting** | Railway.com | Simple deployment for the frontend static build and any supplementary services. Integrates well with Supabase. |
| **Realtime** | Supabase Realtime (WebSocket) | Built into Supabase. Powers live schedule updates, messaging, and notification delivery. |
| **File Storage** | Supabase Storage | Stores policy documents (PDFs), employee avatars, and message attachments. |
| **Geolocation** | Browser Geolocation API + PostGIS | GPS capture at clock-in/out. PostGIS extension on Supabase Postgres for geofence enforcement. |
| **Push Notifications** | Web Push API (in-app initially) | PWA push notifications. Email/SMS can be added later via Supabase Edge Functions + a provider. |
| **CSS / UI** | Tailwind CSS + shadcn/ui | Utility-first CSS with pre-built accessible components. Keeps bundle small and styling consistent. |

## 4. Architecture Philosophy

1. **Supabase-first**: Use Supabase's built-in features (Auth, RLS, Realtime, Storage, Edge Functions) before reaching for external services. This minimizes moving parts and keeps costs predictable.

2. **Serverless by default**: No long-running servers. Edge Functions handle business logic (schedule conflict checks, notification dispatch, payroll calculations). The frontend talks directly to Supabase for CRUD operations via the auto-generated REST API, with RLS enforcing permissions.

3. **PWA-first mobile**: A single React codebase serves desktop and mobile. The PWA is installable on phones, works offline for viewing cached schedules, and supports push notifications.

4. **Multi-tenant by organization**: Each organization is isolated at the database level via `organization_id` foreign keys and RLS policies. A single deployment serves all tenants.

5. **Configurable branding**: Each organization can upload their logo, set primary colors, and customize their workspace name. The platform itself is unbranded / white-label ready.

## 5. Core Modules

| # | Module | Description |
|---|--------|-------------|
| 1 | **Employee Management** | Create, edit, deactivate employee profiles. Assign to schedules, positions, skills. Self-service profile editing for employees. |
| 2 | **Staff Scheduling** | Multi-location calendar with shift creation, templates, auto-scheduling, conflict detection. Views: editor, team, my schedule, availability, open shifts. Request types: swap, offer, drop. |
| 3 | **Attendance / Timesheets** | GPS + geofence clock-in/out. Manual time entries. Timesheet approval workflow. Break tracking. Summary and detail views. |
| 4 | **Time Off** | Policy-based accrual and balance tracking. Request/approve workflow. Blocked days, public holidays. Types: vacation, sick, unpaid, custom. |
| 5 | **Reports** | Scheduled hours, worked hours, scheduled vs. actual, attendance, time off, availability, audit logs. Export to CSV/PDF. |
| 6 | **Messaging** | Direct messages and group chats. Real-time delivery. Online/offline presence. Message history and search. |
| 7 | **Tasks & Policies** | Checklist templates assigned to shifts/roles. Recurring and one-time tasks. Policy document upload with version control and read-acknowledgment tracking. |
| 8 | **Settings** | Org profile, schedules, positions, job sites, access levels, skills, breaks, shift templates, time-off policies, blocked days, holidays, time clock rules, pay rules. |

## 6. Key Non-Functional Requirements

- **Performance**: Page loads under 2s on 4G. Schedule editor renders 50+ employees without jank.
- **Scalability**: Support 500 concurrent users per organization without degradation.
- **Security**: Row-level security on all tables. JWT-based auth. HTTPS everywhere. No sensitive data in URLs.
- **Offline**: PWA caches current week's schedule and recent messages for offline viewing.
- **Accessibility**: WCAG 2.1 AA compliance. Keyboard navigation. Screen reader support.
- **Data Export**: All reports exportable to CSV. Schedules exportable to PDF and iCal.

## 7. Document Index

This project specification consists of the following documents:

| Document | Purpose |
|----------|---------|
| `01-PROJECT-OVERVIEW.md` | This file. High-level scope, stack, and architecture philosophy. |
| `02-PRODUCT-REQUIREMENTS.md` | Detailed feature requirements, user stories, and acceptance criteria per module. |
| `03-DATABASE-SCHEMA.md` | Complete Supabase/PostgreSQL schema with tables, relationships, RLS policies, and indexes. |
| `04-API-ARCHITECTURE.md` | Edge Function endpoints, request/response contracts, and authentication flow. |
| `05-TECHNICAL-ARCHITECTURE.md` | Infrastructure diagram, deployment config, environment variables, CI/CD pipeline. |
| `06-UI-UX-SPECIFICATION.md` | Page layouts, navigation structure, component hierarchy, and responsive behavior. |
| `07-TASKS-POLICIES-SPEC.md` | Deep-dive specification for the Tasks & Policies module (the novel feature). |
| `08-IMPLEMENTATION-ROADMAP.md` | Phased build plan with milestones, dependencies, and effort estimates. |
