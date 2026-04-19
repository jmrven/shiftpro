# ShiftPro — UI/UX Specification

## 1. Design Principles

1. **Desktop-first, mobile-responsive**: Managers use desktop primarily. Employees use mobile primarily. The same codebase serves both, adapting layout via responsive breakpoints.
2. **Minimal clicks**: Common actions (clock in, view my schedule, check tasks) are reachable in 1-2 taps from any screen.
3. **Information density on desktop**: The schedule editor shows as much data as possible without scrolling. Compact rows, small fonts, color-coded shifts.
4. **Simplicity on mobile**: Mobile views strip away admin complexity. Employees see only what they need.
5. **Consistent navigation**: Sidebar on desktop, bottom tab bar on mobile. Same section labels.

## 2. Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Bottom tab bar, stacked layouts, full-width cards |
| Tablet | 768px – 1024px | Collapsible sidebar, 2-column layouts where appropriate |
| Desktop | > 1024px | Fixed sidebar, multi-column layouts, full schedule grid |

## 3. Color System

The app uses a neutral base with organization-configurable accent color.

| Token | Default | Usage |
|-------|---------|-------|
| `--primary` | `#3B82F6` (blue) | Buttons, links, active states. Overridden by org branding. |
| `--primary-hover` | `#2563EB` | Button hover state |
| `--success` | `#10B981` | Approved, completed, clocked-in |
| `--warning` | `#F59E0B` | Pending, attention needed |
| `--danger` | `#EF4444` | Denied, errors, destructive actions |
| `--neutral-50` to `--neutral-900` | Gray scale | Backgrounds, borders, text |
| `--background` | `#FFFFFF` | Page background |
| `--surface` | `#F9FAFB` | Card backgrounds, sidebar |
| `--text-primary` | `#111827` | Headings, primary text |
| `--text-secondary` | `#6B7280` | Secondary text, labels |

Position and schedule colors are user-configurable and displayed as shift block backgrounds and small color dots.

## 4. Navigation Structure

### 4.1 Desktop Sidebar

```
┌──────────────────────┐
│  [Logo / Org Name]   │
├──────────────────────┤
│  ● Dashboard         │
│  ● Employees         │
│  ▼ Schedule          │
│    ├ Schedule Editor  │
│    ├ Team Schedule    │
│    ├ My Schedule      │
│    ├ Availability     │
│    └ Requests         │
│  ▼ Time Off          │
│    ├ Requests         │
│    └ Balances         │
│  ▼ Timesheets        │
│    ├ All Timesheets   │
│    └ My Timesheets    │
│  ● Payroll           │
│  ● Reports           │
│  ● Tasks             │  ← NEW (not in Zoho Shifts)
│  ● Policies          │  ← NEW (not in Zoho Shifts)
│  ● Messages   [badge]│
├──────────────────────┤
│  ⚙ Settings          │
│  👤 Jose Rodriguez    │
│     [role: Admin]     │
└──────────────────────┘
```

- Sidebar is fixed (always visible) on desktop
- Collapsible to icons-only mode on tablet
- Sections with sub-items expand/collapse on click
- Active item is highlighted with primary color background
- Unread message count shown as badge on Messages

### 4.2 Mobile Bottom Tab Bar

```
┌────────────────────────────────────────┐
│  🏠     📅     ⏱     💬     ≡        │
│ Home  Schedule Clock  Chat   More     │
└────────────────────────────────────────┘
```

- **Home**: Dashboard
- **Schedule**: My Schedule (employees) / Schedule Editor (managers)
- **Clock**: Time clock (clock in/out)
- **Chat**: Messages
- **More**: Hamburger menu → Employees, Time Off, Timesheets, Tasks, Policies, Reports, Settings

### 4.3 Top Bar (Desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  [Page Title]                    🔔 [3]  👤 Jose Rodriguez  │
└─────────────────────────────────────────────────────────────┘
```

- Page title (breadcrumb on deeper pages)
- Notification bell with unread count → opens notification center dropdown
- User avatar → dropdown: My Profile, Preferences, Log Out

## 5. Page Layouts

### 5.1 Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD                                                   │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                       │
│  ┌────────────────┐  │  ┌─────────────────────────────────┐ │
│  │  TIME CLOCK    │  │  │  PENDING APPROVALS              │ │
│  │  No shift now  │  │  │  [Time Off] [Swap] [Offer] ...  │ │
│  │  [Clock In]    │  │  │  (request list with actions)     │ │
│  └────────────────┘  │  └─────────────────────────────────┘ │
│                      │                                       │
│  ┌────────────────┐  │  ┌─────────────────────────────────┐ │
│  │  MY UPCOMING   │  │  │  WHO'S WORKING                  │ │
│  │  SHIFTS        │  │  │  [All Schedules ▼]              │ │
│  │  (list)        │  │  │  Employee | Status | Clocked In │ │
│  │  View My Sched │  │  │  David    | 🟢    | 12:25p     │ │
│  └────────────────┘  │  │  Jesse    | 🟢    | 12:30p     │ │
│                      │  │  [Who's Working] [No Show]       │ │
│  ┌────────────────┐  │  └─────────────────────────────────┘ │
│  │  MY TASKS      │  │                                       │
│  │  TODAY         │  │  ┌─────────────────────────────────┐ │
│  │  ☐ Opening     │  │  │  MY RECENT TIME ENTRIES         │ │
│  │    checklist   │  │  │  (list)                          │ │
│  │  3/8 done      │  │  └─────────────────────────────────┘ │
│  └────────────────┘  │                                       │
└──────────────────────┴──────────────────────────────────────┘
```

Mobile: Widgets stack vertically. Time Clock at top, then My Tasks, then Upcoming Shifts.

### 5.2 Schedule Editor

```
┌─────────────────────────────────────────────────────────────┐
│  SCHEDULE EDITOR                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Central ▼] [All Positions ▼] [All Job Sites ▼]        ││
│  │ [Employee View ▼]  ◀ 22 Mar - 28 Mar ▶                 ││
│  │ [Day|Week|2Wk|Month] [Show TimeOff] [Show Availability] ││
│  │ [Tools ▼] [Publish]                                     ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌───────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐│
│  │ Name  │ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  ││
│  ├───────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤│
│  │OPEN   │      │ +    │      │      │      │ +    │      ││
│  ├───────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤│
│  │Alex P │      │██8-4 │██8-4 │      │██8-4 │██8-4 │      ││
│  │0h/$0  │      │Wrglr │Wrglr │      │Wrglr │Wrglr │      ││
│  ├───────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤│
│  │Jose R │      │      │      │██9-5 │██9-5 │      │      ││
│  │0h/$0  │      │      │      │Mgr   │Mgr   │      │      ││
│  ├───────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤│
│  │...    │      │      │      │      │      │      │      ││
│  ├───────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤│
│  │TOTALS │ 0h   │ 16h  │ 16h  │ 8h   │ 16h  │ 16h  │ 0h  ││
│  │       │ $0   │ $256 │ $256 │ $128 │ $256 │ $256 │ $0  ││
│  └───────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘│
│  [+ Add Employee]                                            │
└─────────────────────────────────────────────────────────────┘
```

**Shift blocks**: Color-coded by position. Show time range and position abbreviation. Click to edit. Drag to move.

**Empty cells**: Click to create a new shift. "+" appears on hover.

**Mobile schedule editor**: Switches to day view. Shows one day at a time with a horizontal date scroller. Each employee is a card with their shift details.

### 5.3 Shift Creation/Edit Modal

```
┌────────────────────────────────────────┐
│  Create Shift                    [X]   │
├────────────────────────────────────────┤
│  Employee:  [Alex Pavajaeu ▼]          │
│  Position:  [Wrangler ▼]              │
│  Job Site:  [Central ▼]               │
│  Date:      [03/25/2026]              │
│  Start:     [08:00 AM]                │
│  End:       [04:00 PM]                │
│  Break:     [30 min ▼]               │
│  Notes:     [________________]        │
│                                        │
│  ⚠ Conflict: overlaps with existing   │
│    shift 2-6 PM on same day           │
│                                        │
│  [Cancel]              [Save as Draft] │
│                        [Save & Publish]│
└────────────────────────────────────────┘
```

### 5.4 Employee List

```
┌─────────────────────────────────────────────────────────────┐
│  EMPLOYEES                               [+ Add Employee]   │
│  ┌──────────────────────────────────────────────────────── ┐│
│  │ [All Schedules ▼] [All Positions ▼] [Active ▼]        ││
│  │ [Search: _______________]                               ││
│  └─────────────────────────────────────────────────────── ┘│
│  ┌──────────────────────────────────────────────────────── ┐│
│  │ 👤 Alex Pavajaeu    | Wrangler     | Central  | Active ││
│  │ 👤 Jose Rodriguez   | Manager      | Central  | Active ││
│  │ 👤 Maria Acosta     | Front Desk   | SoDo     | Active ││
│  │ ...                                                     ││
│  └─────────────────────────────────────────────────────── ┘│
│  Showing 1-50 of 23                    [< 1 2 3 >]         │
└─────────────────────────────────────────────────────────────┘
```

Click row → opens Employee Profile page with tabs: Profile, Schedule, Timesheets, Time Off, Tasks, Skills.

### 5.5 Time Off Requests

```
┌─────────────────────────────────────────────────────────────┐
│  TIME OFF REQUESTS                    [Request Time Off]     │
│  [List] [Calendar]                                          │
│  ┌─────────────────────────────────────────────────────── ┐│
│  │ [All Schedules ▼] [All Requests ▼] [All Employees ▼]  ││
│  │ [Date range: ___________]  [Sort: Time Off Date ▼]     ││
│  │ [Export]                                                ││
│  └─────────────────────────────────────────────────────── ┘│
│  ┌──────────────────────────────────────────────────────── ┐│
│  │ Employee   | Type    | Start      | End       | Status ││
│  │ Kye D.     | Unpaid  | Jun 12     | Jun 17    | 🟡Pend ││
│  │ Kristina H.| Unpaid  | Mar 30     | Mar 30    | 🟢Appr ││
│  │ Ali B.     | Sick    | Mar 19 8a  | Mar 19 1p | 🟢Appr ││
│  └─────────────────────────────────────────────────────── ┘│
└─────────────────────────────────────────────────────────────┘
```

Click row → expands detail panel with approve/deny actions (for managers).

### 5.6 Timesheets

```
┌─────────────────────────────────────────────────────────────┐
│  TIMESHEETS                              [+ Add Time]       │
│  [List] [Summary]                                           │
│  ┌─────────────────────────────────────────────────────── ┐│
│  │ [Central ▼] [All Employees ▼] [All Status ▼]          ││
│  │ [Date range: 03/26/2026 ▼]  [Day|Week|Pay Period]      ││
│  └─────────────────────────────────────────────────────── ┘│
│  ┌──────────────────────────────────────────────────────── ┐│
│  │ Employee   | Date   | In     | Out    | Break | Total  ││
│  │ David B.   | Mar 27 | 12:25p | -      | 0m    | -      ││
│  │ Jesse K.   | Mar 27 | 12:30p | -      | 0m    | -      ││
│  │ Ty D.      | Mar 27 | 10:03a | -      | 0m    | -      ││
│  └─────────────────────────────────────────────────────── ┘│
└─────────────────────────────────────────────────────────────┘
```

### 5.7 Chat Widget (Slide-out Panel)

Present on every page as a floating button in the bottom-right corner, similar to Zoho Shifts.

```
┌──────────────────────────────┐
│  💬 Messages          [X]    │
├──────────────────────────────┤
│  [Chats] [Channels] [Contacts]
│  [Search: _______________]   │
├──────────────────────────────┤
│  #Scheduling at DogCity      │
│  You: ...           Today 6p │
│                              │
│  Maria Acosta                │
│  You: Ya esto...    Today 5p │
│                              │
│  #Cute Dogs                  │
│  Kristina: Love...  Today 5p │
│  [4 unread]                  │
│                              │
│  ...                         │
└──────────────────────────────┘
```

Click on a conversation → opens chat window inside the panel. Full-page messaging at `/messages` route.

### 5.8 Tasks Page

```
┌─────────────────────────────────────────────────────────────┐
│  TASKS                                                       │
│  [My Tasks] [All Tasks] [Templates]                         │
├─────────────────────────────────────────────────────────────┤
│  TODAY - March 27, 2026                                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📋 Opening Checklist              3/8 complete  [▼]   │ │
│  │    ☑ Unlock doors                                      │ │
│  │    ☑ Turn on lights & HVAC                             │ │
│  │    ☑ Check overnight cameras                           │ │
│  │    ☐ Restock supplies                                  │ │
│  │    ☐ Check feeding schedules                           │ │
│  │    ☐ Inspect play areas                                │ │
│  │    ☐ Update whiteboard                                 │ │
│  │    ☐ Brief arriving staff                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📋 Deep Clean - Kennels           0/5 complete  [▼]   │ │
│  │    ☐ Pressure wash floors                              │ │
│  │    ☐ Sanitize water bowls                              │ │
│  │    ...                                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.9 Policies Page

```
┌─────────────────────────────────────────────────────────────┐
│  POLICIES                              [+ Upload Policy]    │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📄 Employee Handbook            v3  |  Updated Mar 1  │ │
│  │    22/25 employees acknowledged                        │ │
│  │    [View] [View Acknowledgments]                       │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ 📄 Safety Protocol              v2  |  Updated Feb 15 │ │
│  │    🟡 You need to acknowledge this version             │ │
│  │    [Read & Acknowledge] [View History]                 │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ 📄 Dress Code                   v1  |  Created Jan 10 │ │
│  │    ✅ Acknowledged                                     │ │
│  │    [View]                                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.10 Settings Page

```
┌────────────────┬────────────────────────────────────────────┐
│  SETTINGS      │  GENERAL                                   │
│                │                                             │
│  General       │  Organization Name: [Seattle Canine Club]  │
│  Schedules     │  Timezone:          [America/Los_Angeles▼] │
│  Positions     │  Date Format:       ○ mm/dd/yyyy           │
│  Job Sites     │                     ○ dd/mm/yyyy           │
│  Access Levels │  Time Format:       ○ 12 Hours             │
│  Skills        │                     ○ 24 Hours             │
│                │  Week Starts On:    [Sunday ▼]             │
│  SCHEDULING    │                                             │
│  Preferences   │  Business Hours:                            │
│  Breaks        │  ☑ Monday    [6:00 AM] - [7:00 PM]        │
│  Shift Template│  ☑ Tuesday   [6:00 AM] - [7:00 PM]        │
│                │  ...                                        │
│  TIME OFF      │                                             │
│  Preferences   │  [Save]                                     │
│  Policies      │                                             │
│  Blocked Days  │  Account Owner: Jose Rodriguez              │
│  Holidays      │  [Change Account Owner]                     │
│                │                                             │
│  ATTENDANCE    │                                             │
│  Time Clock    │                                             │
│  Pay Rules     │                                             │
│  Payroll       │                                             │
│                │                                             │
│  OTHER         │                                             │
│  Messaging     │                                             │
│  Branding      │                                             │
│  Data Backup   │                                             │
└────────────────┴────────────────────────────────────────────┘
```

## 6. Notifications UI

### 6.1 Notification Bell Dropdown

```
┌────────────────────────────────────┐
│  Notifications              [Mark all read]
├────────────────────────────────────┤
│  🟢 Schedule published for next week
│     Central · 2 min ago
│  🟡 Time off request from Ali B.
│     Sick · Mar 19 · 5 min ago
│  🟢 Kristina completed Opening Checklist
│     Tasks · 15 min ago
│  ...
│  [See all notifications →]
└────────────────────────────────────┘
```

## 7. Mobile-Specific Patterns

### 7.1 Time Clock (Mobile Priority)

Large, thumb-friendly clock button centered on screen. Shows current status prominently. GPS status indicator.

```
┌──────────────────────────┐
│  ⏱ TIME CLOCK            │
│                           │
│  Currently: Not clocked in│
│  No shift scheduled       │
│                           │
│     ┌──────────────┐     │
│     │              │     │
│     │   CLOCK IN   │     │
│     │              │     │
│     └──────────────┘     │
│                           │
│  📍 GPS: Enabled          │
│  🏢 Central (within range)│
└──────────────────────────┘
```

### 7.2 My Schedule (Mobile)

Scrollable day cards. Tap to expand shift details.

```
┌──────────────────────────┐
│  MY SCHEDULE              │
│  ◀ This Week ▶           │
│                           │
│  MON Mar 23               │
│  ┌──────────────────────┐│
│  │ 8:00 AM - 4:00 PM    ││
│  │ Wrangler · Central    ││
│  │ Break: 30 min         ││
│  └──────────────────────┘│
│                           │
│  TUE Mar 24               │
│  No shift scheduled       │
│                           │
│  WED Mar 25               │
│  ┌──────────────────────┐│
│  │ 11:00 AM - 7:00 PM   ││
│  │ Front Desk · SoDo     ││
│  └──────────────────────┘│
└──────────────────────────┘
```

## 8. Accessibility Requirements

- All interactive elements have visible focus indicators (2px ring)
- Color is never the sole indicator of state (always paired with text/icon)
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text
- All images/icons have alt text or aria-label
- Schedule grid navigable via arrow keys
- Screen reader announces shift details on focus
- Modals trap focus and close on Escape
- Touch targets: minimum 44x44px on mobile
- Reduced motion: respect `prefers-reduced-motion` for animations
