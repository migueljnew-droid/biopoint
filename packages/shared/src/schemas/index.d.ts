export * from './auth.js';
export * from './profile.js';
export * from './dashboard.js';
export * from './stacks.js';
export * from './labs.js';
export * from './photos.js';
export * from './community.js';
export * from './reminders.js';
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
//# sourceMappingURL=index.d.ts.map