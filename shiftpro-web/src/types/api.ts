export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// Edge Function request/response types — add per function as built

export interface ClockActionRequest {
  action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  job_site_id?: string;
  latitude?: number;
  longitude?: number;
}

export interface InviteEmployeeRequest {
  email: string;
  first_name: string;
  last_name: string;
  role: 'manager' | 'employee';
  position_ids?: string[];
  schedule_ids?: string[];
}

export interface PublishScheduleRequest {
  schedule_id: string;
  week_start: string;
  notify_employees: boolean;
}

export interface RequestTimeOffRequest {
  type_id: string;
  start_date: string;
  end_date: string;
  notes?: string;
}

export interface HandleTimeOffRequest {
  request_id: string;
  action: 'approve' | 'reject';
  notes?: string;
}

export interface GenerateReportRequest {
  report_type: string;
  start_date: string;
  end_date: string;
  schedule_ids?: string[];
  position_ids?: string[];
  format: 'json' | 'csv';
}
