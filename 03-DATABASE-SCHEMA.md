# ShiftPro — Database Schema (Supabase / PostgreSQL)

## 1. Design Principles

1. **Multi-tenant via `organization_id`**: Every table that holds user data includes an `organization_id` column. Row-Level Security (RLS) policies enforce that users can only see data belonging to their organization.
2. **Soft deletes where appropriate**: Employees and key entities use `status` or `deleted_at` rather than hard deletes, preserving historical data integrity.
3. **UUID primary keys**: All tables use `uuid` primary keys generated with `gen_random_uuid()`.
4. **Timestamps everywhere**: All tables include `created_at` and `updated_at` columns with automatic triggers.
5. **PostGIS enabled**: The `postgis` extension is enabled for geolocation features.

## 2. Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search / fuzzy matching
```

## 3. Enum Types

```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'employee');
CREATE TYPE employee_status AS ENUM ('active', 'inactive');
CREATE TYPE shift_status AS ENUM ('draft', 'published');
CREATE TYPE request_type AS ENUM ('swap', 'offer', 'drop', 'open_shift');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'denied', 'canceled');
CREATE TYPE timeoff_request_status AS ENUM ('pending', 'approved', 'denied', 'canceled');
CREATE TYPE timesheet_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE clock_event_type AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end');
CREATE TYPE task_recurrence AS ENUM ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'custom');
CREATE TYPE task_instance_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE task_item_status AS ENUM ('pending', 'completed');
CREATE TYPE accrual_frequency AS ENUM ('annually', 'monthly', 'per_pay_period');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
```

## 4. Core Tables

### 4.1 Organizations

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,  -- URL-friendly identifier
    timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    time_format TEXT NOT NULL DEFAULT '12h',  -- '12h' or '24h'
    week_start_day day_of_week NOT NULL DEFAULT 'sunday',
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3B82F6',
    owner_id UUID,  -- references profiles.id, set after first user created
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Profiles (Users)

Extends Supabase Auth. Every `auth.users` entry has a corresponding `profiles` row.

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'employee',
    status employee_status NOT NULL DEFAULT 'active',
    employee_external_id TEXT,  -- For payroll integration
    hire_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_profiles_org_status ON profiles(organization_id, status);
CREATE INDEX idx_profiles_name ON profiles(organization_id, first_name, last_name);
```

### 4.3 Schedules (Locations / Teams)

```sql
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_schedules_org ON schedules(organization_id);
```

### 4.4 Positions (Roles)

```sql
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#10B981',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_positions_org ON positions(organization_id);
```

### 4.5 Job Sites

```sql
CREATE TABLE job_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    address TEXT,
    location GEOGRAPHY(POINT, 4326),  -- PostGIS point (lng, lat)
    geofence_radius_meters INTEGER DEFAULT 200,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_job_sites_org ON job_sites(organization_id);
CREATE INDEX idx_job_sites_location ON job_sites USING GIST(location);
```

### 4.6 Skills

```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);
```

## 5. Assignment / Junction Tables

### 5.1 Employee ↔ Schedule

```sql
CREATE TABLE employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, schedule_id)
);

CREATE INDEX idx_emp_sched_profile ON employee_schedules(profile_id);
CREATE INDEX idx_emp_sched_schedule ON employee_schedules(schedule_id);
```

### 5.2 Employee ↔ Position

```sql
CREATE TABLE employee_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    pay_rate DECIMAL(10,2),  -- Hourly rate for this position
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, position_id)
);

CREATE INDEX idx_emp_pos_profile ON employee_positions(profile_id);
CREATE INDEX idx_emp_pos_position ON employee_positions(position_id);
```

### 5.3 Employee ↔ Skill

```sql
CREATE TABLE employee_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, skill_id)
);

CREATE INDEX idx_emp_skill_profile ON employee_skills(profile_id);
CREATE INDEX idx_emp_skill_expiry ON employee_skills(expiry_date);
```

### 5.4 Manager ↔ Schedule

```sql
CREATE TABLE manager_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, schedule_id)
);
```

## 6. Scheduling Tables

### 6.1 Shifts

```sql
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    schedule_id UUID NOT NULL REFERENCES schedules(id),
    profile_id UUID REFERENCES profiles(id),  -- NULL = open shift
    position_id UUID REFERENCES positions(id),
    job_site_id UUID REFERENCES job_sites(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    notes TEXT,
    status shift_status NOT NULL DEFAULT 'draft',
    is_open_shift BOOLEAN NOT NULL DEFAULT false,
    color TEXT,  -- Override color, otherwise inherits from position
    created_by UUID REFERENCES profiles(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_shift_times CHECK (end_time > start_time)
);

CREATE INDEX idx_shifts_org ON shifts(organization_id);
CREATE INDEX idx_shifts_schedule ON shifts(schedule_id);
CREATE INDEX idx_shifts_profile ON shifts(profile_id);
CREATE INDEX idx_shifts_time ON shifts(schedule_id, start_time, end_time);
CREATE INDEX idx_shifts_open ON shifts(schedule_id, is_open_shift) WHERE is_open_shift = true;
```

### 6.2 Schedule Templates

```sql
CREATE TABLE schedule_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    schedule_id UUID NOT NULL REFERENCES schedules(id),
    name TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_template_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
    position_id UUID REFERENCES positions(id),
    day_of_week day_of_week NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.3 Shift Templates (Quick-create presets)

```sql
CREATE TABLE shift_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    position_id UUID REFERENCES positions(id),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.4 Shift Requests

```sql
CREATE TABLE shift_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    type request_type NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    requester_id UUID NOT NULL REFERENCES profiles(id),
    shift_id UUID NOT NULL REFERENCES shifts(id),
    target_shift_id UUID REFERENCES shifts(id),      -- For swaps: the other shift
    target_profile_id UUID REFERENCES profiles(id),   -- For swaps/offers: the other employee
    manager_note TEXT,
    requester_note TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shift_requests_org ON shift_requests(organization_id);
CREATE INDEX idx_shift_requests_status ON shift_requests(organization_id, status);
CREATE INDEX idx_shift_requests_requester ON shift_requests(requester_id);
```

## 7. Availability

```sql
CREATE TABLE employee_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    day_of_week day_of_week NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    start_time TIME,  -- If available, the window start (NULL = all day)
    end_time TIME,    -- If available, the window end (NULL = all day)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, day_of_week)
);

CREATE INDEX idx_availability_profile ON employee_availability(profile_id);
```

## 8. Attendance / Timesheets

### 8.1 Clock Events

```sql
CREATE TABLE clock_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    event_type clock_event_type NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location GEOGRAPHY(POINT, 4326),  -- GPS coordinates
    is_within_geofence BOOLEAN,
    geofence_job_site_id UUID REFERENCES job_sites(id),
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clock_events_org ON clock_events(organization_id);
CREATE INDEX idx_clock_events_profile ON clock_events(profile_id, timestamp);
CREATE INDEX idx_clock_events_time ON clock_events(organization_id, timestamp);
```

### 8.2 Timesheets (Computed from clock events or manual entry)

```sql
CREATE TABLE timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    schedule_id UUID REFERENCES schedules(id),
    shift_id UUID REFERENCES shifts(id),  -- Linked shift, if any
    date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    clock_in_location GEOGRAPHY(POINT, 4326),
    clock_out_location GEOGRAPHY(POINT, 4326),
    break_minutes INTEGER DEFAULT 0,
    total_minutes INTEGER,  -- Computed: (clock_out - clock_in) - break_minutes
    regular_minutes INTEGER,
    overtime_minutes INTEGER,
    is_manual_entry BOOLEAN DEFAULT false,
    status timesheet_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timesheets_org ON timesheets(organization_id);
CREATE INDEX idx_timesheets_profile ON timesheets(profile_id, date);
CREATE INDEX idx_timesheets_date ON timesheets(organization_id, date);
CREATE INDEX idx_timesheets_status ON timesheets(organization_id, status);
```

## 9. Time Off

### 9.1 Time Off Types

```sql
CREATE TABLE timeoff_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#F59E0B',
    is_paid BOOLEAN NOT NULL DEFAULT false,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    min_notice_days INTEGER DEFAULT 0,
    max_consecutive_days INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);
```

### 9.2 Time Off Policies (Accrual Rules)

```sql
CREATE TABLE timeoff_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    timeoff_type_id UUID NOT NULL REFERENCES timeoff_types(id),
    name TEXT NOT NULL,
    accrual_frequency accrual_frequency NOT NULL DEFAULT 'annually',
    accrual_amount DECIMAL(8,2) NOT NULL DEFAULT 0,  -- Hours accrued per period
    max_balance DECIMAL(8,2),  -- Cap on total balance
    carryover_max DECIMAL(8,2),  -- Max hours carried into next year
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which employees are on which policy
CREATE TABLE employee_timeoff_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES timeoff_policies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, policy_id)
);
```

### 9.3 Time Off Balances

```sql
CREATE TABLE timeoff_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    timeoff_type_id UUID NOT NULL REFERENCES timeoff_types(id),
    balance_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    used_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    pending_hours DECIMAL(8,2) NOT NULL DEFAULT 0,  -- Hours in pending requests
    last_accrual_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, timeoff_type_id)
);

CREATE INDEX idx_timeoff_balances_profile ON timeoff_balances(profile_id);
```

### 9.4 Time Off Requests

```sql
CREATE TABLE timeoff_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    timeoff_type_id UUID NOT NULL REFERENCES timeoff_types(id),
    start_date DATE NOT NULL,
    start_time TIME,  -- NULL = full day
    end_date DATE NOT NULL,
    end_time TIME,    -- NULL = full day
    total_hours DECIMAL(8,2),
    status timeoff_request_status NOT NULL DEFAULT 'pending',
    employee_note TEXT,
    manager_note TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeoff_requests_org ON timeoff_requests(organization_id);
CREATE INDEX idx_timeoff_requests_profile ON timeoff_requests(profile_id);
CREATE INDEX idx_timeoff_requests_status ON timeoff_requests(organization_id, status);
CREATE INDEX idx_timeoff_requests_dates ON timeoff_requests(organization_id, start_date, end_date);
```

### 9.5 Balance Adjustments (Manual)

```sql
CREATE TABLE timeoff_balance_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    timeoff_type_id UUID NOT NULL REFERENCES timeoff_types(id),
    adjustment_hours DECIMAL(8,2) NOT NULL,  -- Positive = add, negative = deduct
    reason TEXT NOT NULL,
    adjusted_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 9.6 Blocked Days & Public Holidays

```sql
CREATE TABLE blocked_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    date DATE NOT NULL,
    name TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, date)
);

CREATE TABLE public_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    date DATE NOT NULL,
    name TEXT NOT NULL,
    is_paid BOOLEAN DEFAULT false,
    pay_multiplier DECIMAL(4,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, date)
);
```

## 10. Messaging

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT,  -- NULL for DMs, set for group chats
    is_group BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    is_muted BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, profile_id)
);

CREATE INDEX idx_conv_members_profile ON conversation_members(profile_id);
CREATE INDEX idx_conv_members_conv ON conversation_members(conversation_id);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

## 11. Tasks & Policies

### 11.1 Checklist Templates

```sql
CREATE TABLE checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    recurrence task_recurrence NOT NULL DEFAULT 'none',
    recurrence_config JSONB,  -- For custom: {days_of_week: [], time: "08:00"}
    assign_to_position_id UUID REFERENCES positions(id),  -- Auto-assign to this role
    assign_to_schedule_id UUID REFERENCES schedules(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_templates_org ON checklist_templates(organization_id);
```

### 11.2 Checklist Template Items

```sql
CREATE TABLE checklist_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_items_template ON checklist_template_items(template_id, sort_order);
```

### 11.3 Task Instances (Concrete assignments)

```sql
CREATE TABLE task_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    template_id UUID REFERENCES checklist_templates(id),
    title TEXT NOT NULL,  -- Copied from template, or set for ad-hoc
    description TEXT,
    assigned_to UUID REFERENCES profiles(id),  -- Specific person
    assigned_to_position_id UUID REFERENCES positions(id),  -- Or role-based
    assigned_to_shift_id UUID REFERENCES shifts(id),  -- Or shift-based
    due_date DATE NOT NULL,
    status task_instance_status NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_instances_org ON task_instances(organization_id);
CREATE INDEX idx_task_instances_assigned ON task_instances(assigned_to, due_date);
CREATE INDEX idx_task_instances_date ON task_instances(organization_id, due_date);
CREATE INDEX idx_task_instances_position ON task_instances(assigned_to_position_id, due_date);
```

### 11.4 Task Instance Items

```sql
CREATE TABLE task_instance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status task_item_status NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_items_instance ON task_instance_items(task_instance_id, sort_order);
```

### 11.5 Policies

```sql
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policies_org ON policies(organization_id);
```

### 11.6 Policy Versions

```sql
CREATE TABLE policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_url TEXT NOT NULL,  -- Supabase Storage URL
    file_name TEXT NOT NULL,
    file_size INTEGER,
    changelog TEXT,  -- What changed in this version
    published_by UUID REFERENCES profiles(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(policy_id, version_number)
);

CREATE INDEX idx_policy_versions_policy ON policy_versions(policy_id, version_number);
```

### 11.7 Policy Acknowledgments

```sql
CREATE TABLE policy_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_version_id UUID NOT NULL REFERENCES policy_versions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(policy_version_id, profile_id)
);

CREATE INDEX idx_policy_ack_profile ON policy_acknowledgments(profile_id);
CREATE INDEX idx_policy_ack_version ON policy_acknowledgments(policy_version_id);
```

## 12. Notifications

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    recipient_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    body TEXT,
    type TEXT NOT NULL,  -- 'schedule_published', 'shift_assigned', 'timeoff_approved', etc.
    reference_type TEXT,  -- 'shift', 'timeoff_request', 'shift_request', 'message', 'task', 'policy'
    reference_id UUID,    -- ID of the referenced entity
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_org ON notifications(organization_id, created_at DESC);
```

## 13. Notification Preferences

```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,  -- Same as notifications.type
    in_app BOOLEAN NOT NULL DEFAULT true,
    email BOOLEAN NOT NULL DEFAULT false,  -- For future use
    sms BOOLEAN NOT NULL DEFAULT false,    -- For future use
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, event_type)
);
```

## 14. Audit Log

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_id UUID REFERENCES profiles(id),  -- NULL for system actions
    action TEXT NOT NULL,  -- 'create', 'update', 'delete', 'login', 'approve', etc.
    entity_type TEXT NOT NULL,  -- 'shift', 'timesheet', 'timeoff_request', 'profile', 'setting', etc.
    entity_id UUID,
    changes JSONB,  -- {field: {old: X, new: Y}} for updates
    metadata JSONB,  -- Additional context
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

## 15. Organization Business Hours

```sql
CREATE TABLE business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    day_of_week day_of_week NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT true,
    open_time TIME,
    close_time TIME,
    UNIQUE(organization_id, day_of_week)
);
```

## 16. Break Rules

```sql
CREATE TABLE break_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    auto_deduct BOOLEAN NOT NULL DEFAULT false,
    after_hours DECIMAL(4,2),  -- Applies after X hours worked
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 17. Pay Rules

```sql
CREATE TABLE pay_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    daily_overtime_threshold DECIMAL(4,2),   -- Hours per day before OT kicks in
    weekly_overtime_threshold DECIMAL(4,2),  -- Hours per week before OT kicks in
    overtime_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    holiday_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    night_differential_start TIME,
    night_differential_end TIME,
    night_differential_amount DECIMAL(6,2),  -- Extra $ per hour
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 18. Row-Level Security (RLS) Policy Patterns

All tables with `organization_id` follow this pattern:

```sql
-- Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- Users can only see rows from their organization
CREATE POLICY "org_isolation" ON [table_name]
    FOR ALL
    USING (
        organization_id = (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Additional policies per role as needed:
-- Example: Only admins can insert into settings tables
CREATE POLICY "admin_only_insert" ON [table_name]
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
            AND organization_id = [table_name].organization_id
        )
    );
```

### Key RLS Policy Requirements

1. **profiles**: Users see all profiles in their org (for messaging contacts). Users can only UPDATE their own profile (except admins).
2. **shifts**: Employees see published shifts in their schedule(s). Managers see all shifts in their assigned schedules. Admins see all.
3. **timesheets**: Employees see only their own. Managers see timesheets for their schedules. Admins see all.
4. **messages**: Users only see messages in conversations they're members of.
5. **notifications**: Users only see their own notifications.
6. **audit_logs**: Only admins can read audit logs.

## 19. Database Functions & Triggers

### Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON [table_name]
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Create profile on user signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, organization_id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'organization_id')::UUID,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee')::user_role
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
```

### Geofence check function

```sql
CREATE OR REPLACE FUNCTION check_geofence(
    p_location GEOGRAPHY(POINT, 4326),
    p_job_site_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_within BOOLEAN;
BEGIN
    SELECT ST_DWithin(p_location, js.location, js.geofence_radius_meters)
    INTO v_within
    FROM job_sites js
    WHERE js.id = p_job_site_id;

    RETURN COALESCE(v_within, false);
END;
$$ LANGUAGE plpgsql;
```
