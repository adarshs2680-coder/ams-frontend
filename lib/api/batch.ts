/**
 * Batch API Service
 * Handles all batch-related API operations for academic management
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export type Department = 'CSE' | 'ECE' | 'IT';

export interface StaffAdvisor {
  _id: string;
  first_name: string;
  last_name: string;
  name?: string;
  email: string;
  role?: string;
}

export interface Batch {
  _id: string;
  // Human-readable batch id (e.g. 24CSE)
  id?: string;
  name: string;
  adm_year: number;
  department: Department;
  staff_advisor: StaffAdvisor;
  scheme: string;
  sem: string;
  // Number of students currently in this batch (returned by list endpoint only).
  studentCount?: number;
}

export interface ApiResponse<T> {
  status_code: number;
  message: string;
  data: T;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListBatchesResponse {
  batches: Batch[];
  pagination: PaginationInfo;
}

export interface ListBatchesParams {
  page?: number;
  limit?: number;
  department?: Department;
  adm_year?: number;
}

export interface CreateBatchData {
  // Optional human-readable batch id; backend can auto-generate if omitted
  id?: string;
  name: string;
  adm_year: number;
  department: Department;
  staff_advisor: string; // Teacher ObjectId
  scheme: string;
  sem: string;
}

export interface UpdateBatchData {
  id?: string;
  name?: string;
  adm_year?: number;
  department?: Department;
  staff_advisor?: string;
  scheme?: string;
  sem?: string;
}

function extractApiMessage(payload: unknown): string {
  const p = (payload ?? {}) as {
    message?: string;
    error?: string | { message?: string };
    data?: string | { message?: string; error?: string | { message?: string } };
  };

  if (typeof p.message === 'string' && p.message.trim()) return p.message;
  if (typeof p.error === 'string' && p.error.trim()) return p.error;
  if (typeof p.error === 'object' && typeof p.error?.message === 'string' && p.error.message.trim()) {
    return p.error.message;
  }
  if (typeof p.data === 'string' && p.data.trim()) return p.data;
  if (typeof p.data === 'object') {
    const d = p.data;
    if (typeof d?.message === 'string' && d.message.trim()) return d.message;
    if (typeof d?.error === 'string' && d.error.trim()) return d.error;
    if (typeof d?.error === 'object' && typeof d.error?.message === 'string' && d.error.message.trim()) {
      return d.error.message;
    }
  }

  return '';
}

export function getUnknownErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;

  if (err && typeof err === 'object') {
    const obj = err as { message?: unknown; error?: unknown; data?: unknown };
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
    const extracted = extractApiMessage(err);
    if (extracted) return extracted;
  }

  return fallback;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return fallback;

  try {
    const payload = JSON.parse(text);
    return extractApiMessage(payload) || text || fallback;
  } catch {
    return text || fallback;
  }
}

type ParsedResponse<T> = {
  payload: Partial<ApiResponse<T>>;
  message: string;
};

async function parseResponsePayload<T>(response: Response): Promise<ParsedResponse<T>> {
  const text = await response.text().catch(() => '');

  if (!text) {
    return {
      payload: {},
      message: '',
    };
  }

  try {
    const payload = JSON.parse(text) as Partial<ApiResponse<T>>;
    return {
      payload,
      message: extractApiMessage(payload) || '',
    };
  } catch {
    return {
      payload: {},
      message: text,
    };
  }
}

export function isKnownPopulateResponseIssue(message?: string): boolean {
  const m = (message || "").toLowerCase();
  if (!m) return false;

  return (
    m.includes("strictpopulate") ||
    m.includes("cannot populate") ||
    m.includes("failed to retrieve batch") ||
    m.includes("failed to update batch") ||
    m.includes("failed to create batch") ||
    m.includes("an error occurred while updating batch") ||
    m.includes("an error occurred while creating batch") ||
    (m.includes("populate") && (m.includes("batch") || m.includes("staff_advisor") || m.includes("path")))
  );
}

/**
 * List batches with pagination and filtering (staff only)
 */
export async function listBatches(params?: ListBatchesParams): Promise<ListBatchesResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', Math.min(params.limit, 100).toString());
  if (params?.department) queryParams.append('department', params.department);
  if (params?.adm_year) queryParams.append('adm_year', params.adm_year.toString());

  const response = await fetch(`${API_BASE}/academics/batch?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch batches');
  }

  const result: ApiResponse<ListBatchesResponse> = await response.json();
  return result.data;
}

/**
 * Get a specific batch by ID
 */
export async function getBatchById(id: string): Promise<Batch> {
  const response = await fetch(`${API_BASE}/academics/batch/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch batch');
  }

  const result: ApiResponse<Batch> = await response.json();
  return result.data;
}

/**
 * Create a new batch (admin only)
 */
export async function createBatch(data: CreateBatchData): Promise<Batch> {
  const response = await fetch(`${API_BASE}/academics/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const { payload, message } = await parseResponsePayload<Batch>(response);

  if (!response.ok) {
    const fallback = message || payload.message || 'Failed to create batch';
    throw new Error(fallback);
  }

  return (payload.data as Batch) || ({} as Batch);
}

/**
 * Update a batch by ID (admin only)
 */
export async function updateBatchById(id: string, data: UpdateBatchData): Promise<Batch> {
  const response = await fetch(`${API_BASE}/academics/batch/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const { payload, message } = await parseResponsePayload<Batch>(response);

  if (!response.ok) {
    const fallback = message || payload.message || 'Failed to update batch';
    throw new Error(fallback);
  }

  return (payload.data as Batch) || ({} as Batch);
}

/**
 * Delete a batch by ID (admin only)
 */
export async function deleteBatchById(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/academics/batch/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete batch');
  }
}

export interface AdvanceSemResult {
  _id: string;
  name: string;
  previousSem: string;
  sem: string;
}

/**
 * Advance the semester for a set of batches (admin only).
 * - Pass `sem` to set all selected batches to that exact value.
 * - Omit `sem` to increment each batch's current semester by 1 (capped at 8).
 */
export async function advanceBatchSemesters(
  batchIds: string[],
  sem?: number
): Promise<AdvanceSemResult[]> {
  const response = await fetch(`${API_BASE}/academics/batch/advance-sem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ batchIds, ...(sem != null ? { sem } : {}) }),
  });

  const { payload, message } = await parseResponsePayload<{ updated: AdvanceSemResult[] }>(response);

  if (!response.ok) {
    throw new Error(message || payload.message || 'Failed to advance semester');
  }

  return payload.data?.updated ?? [];
}

/** Sentinel `sem` value marking a batch as graduated/alumni. */
export const ALUMNI_SEM = "100";

export function isAlumniSem(sem: string): boolean {
  return sem === ALUMNI_SEM;
}

/**
 * Converts semester-8 batches to alumni (admin only, one-way). Batches not
 * currently at semester 8 will be rejected by the backend.
 */
export async function convertBatchesToAlumni(batchIds: string[]): Promise<AdvanceSemResult[]> {
  const response = await fetch(`${API_BASE}/academics/batch/convert-alumni`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ batchIds }),
  });

  const { payload, message } = await parseResponsePayload<{ updated: AdvanceSemResult[] }>(response);

  if (!response.ok) {
    throw new Error(message || payload.message || 'Failed to convert batches to alumni');
  }

  return payload.data?.updated ?? [];
}

export type CreateBatchesBulkResponse = ApiResponse<{
  success?: Array<{ name: string; batchId?: string }>;
  failed?: Array<{ name?: string; error?: string }>;
}> & { httpStatus: number };

export async function createBatchesBulk(batches: Partial<CreateBatchData>[]): Promise<CreateBatchesBulkResponse> {
  const success: Array<{ name: string; batchId?: string }> = [];
  const failed: Array<{ name?: string; error?: string }> = [];
  
  for (const batch of batches) {
    try {
      const res = await createBatch(batch as CreateBatchData);
      success.push({ name: batch.name || 'Unknown', batchId: res._id });
    } catch (err: unknown) {
      const message = getUnknownErrorMessage(err, 'Failed to create batch');

      // Backend can persist successfully but fail while populating response payload.
      if (isKnownPopulateResponseIssue(message)) {
        success.push({ name: batch.name || 'Unknown' });
      } else {
        failed.push({ name: batch.name || 'Unknown', error: message });
      }
    }
  }

  const httpStatus = failed.length > 0 ? (success.length > 0 ? 207 : 422) : 200;

  return {
    status_code: httpStatus,
    message: failed.length > 0 ? `Completed with ${failed.length} failures` : "Successfully created all batches",
    data: { success, failed },
    httpStatus
  };
}
