// Auth
export * from './auth';

// Profile
export * from './profile';

// Dashboard & Logs
export * from './dashboard';

// Stacks
export * from './stacks';

// Labs
export * from './labs';

// Photos
export * from './photos';

// Community
export * from './community';

// Reminders
export * from './reminders';

// Nutrition & Fasting
export * from './nutrition';

// Peptides
export * from './peptides';

// Common types
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface ApiError {
    statusCode: number;
    error: string;
    message: string;
}
