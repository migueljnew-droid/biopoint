import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '@biopoint/db';
import type { JwtPayload } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload as object, JWT_SECRET, {
        expiresIn: JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
    });
}

export function generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(userId: string): Promise<string> {
    const token = generateRefreshToken();
    const tokenHash = hashToken(token);

    // Calculate expiry
    const expiresAt = new Date();
    const daysMatch = JWT_REFRESH_EXPIRES.match(/(\d+)d/);
    const days = daysMatch ? parseInt(daysMatch[1]!) : 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    await prisma.refreshToken.create({
        data: {
            tokenHash,
            userId,
            expiresAt,
        },
    });

    return token;
}

export async function verifyRefreshToken(
    token: string
): Promise<{ userId: string; tokenId: string } | null> {
    const tokenHash = hashToken(token);

    const refreshToken = await prisma.refreshToken.findUnique({
        where: { tokenHash },
    });

    if (!refreshToken) {
        return null;
    }

    // Check if revoked
    if (refreshToken.revokedAt) {
        return null;
    }

    // Check if expired
    if (refreshToken.expiresAt < new Date()) {
        return null;
    }

    return {
        userId: refreshToken.userId,
        tokenId: refreshToken.id,
    };
}

export async function rotateRefreshToken(
    oldTokenId: string,
    userId: string
): Promise<string> {
    // Revoke old token
    await prisma.refreshToken.update({
        where: { id: oldTokenId },
        data: { revokedAt: new Date() },
    });

    // Create new token
    return createRefreshToken(userId);
}

export async function revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = hashToken(token);

    await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
    });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

export function parseAccessTokenExpiry(): number {
    const match = JWT_ACCESS_EXPIRES.match(/(\d+)([smhd])/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1]!);
    const unit = match[2];

    switch (unit) {
        case 's':
            return value;
        case 'm':
            return value * 60;
        case 'h':
            return value * 3600;
        case 'd':
            return value * 86400;
        default:
            return 900;
    }
}
