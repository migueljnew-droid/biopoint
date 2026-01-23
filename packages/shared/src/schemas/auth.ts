import { z } from 'zod';

// ============ Auth Schemas ============

export const RegisterSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters'),
});

export const LoginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ============ Auth Response Types ============

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface UserResponse {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
}

export interface AuthResponse {
    user: UserResponse;
    tokens: AuthTokens;
}
