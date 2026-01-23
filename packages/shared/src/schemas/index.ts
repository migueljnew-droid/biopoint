// Auth
export * from './auth.js';

// Profile
export * from './profile.js';

// Dashboard & Logs
export * from './dashboard.js';

// Stacks
export * from './stacks.js';

// Labs
export * from './labs.js';

// Photos
export * from './photos.js';

// Community
export * from './community.js';

// Reminders
export * from './reminders.js';

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
