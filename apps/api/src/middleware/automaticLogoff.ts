import type { FastifyRequest, FastifyReply } from 'fastify';
import { appLogger } from '../utils/appLogger.js';
// prisma import removed — not used in this middleware

// Configuration constants
const WEB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes for web applications
const MOBILE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for mobile applications
const WARNING_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes warning before timeout
const CLEANUP_INTERVAL_MS = 60 * 1000; // Check every minute for expired sessions

interface SessionData {
    userId: string;
    lastActivity: Date;
    deviceType: 'web' | 'mobile';
    ipAddress: string;
    userAgent: string;
    warningSent?: boolean;
}

interface SessionStore {
    [sessionId: string]: SessionData;
}

class SessionManager {
    private sessions: SessionStore = {};
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.startCleanupInterval();
    }

    /**
     * Start the cleanup interval to remove expired sessions
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, CLEANUP_INTERVAL_MS);
    }

    /**
     * Stop the cleanup interval (for testing and shutdown)
     */
    stopCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Create a new session
     */
    createSession(
        sessionId: string,
        userId: string,
        deviceType: 'web' | 'mobile',
        ipAddress: string,
        userAgent: string
    ): void {
        this.sessions[sessionId] = {
            userId,
            lastActivity: new Date(),
            deviceType,
            ipAddress,
            userAgent,
            warningSent: false,
        };
    }

    /**
     * Update session activity
     */
    updateActivity(sessionId: string): void {
        const session = this.sessions[sessionId];
        if (session) {
            session.lastActivity = new Date();
            session.warningSent = false; // Reset warning flag on activity
        }
    }

    /**
     * Get session data
     */
    getSession(sessionId: string): SessionData | null {
        return this.sessions[sessionId] || null;
    }

    /**
     * Remove a session
     */
    removeSession(sessionId: string): void {
        delete this.sessions[sessionId];
    }

    /**
     * Check if session is expired
     */
    isSessionExpired(sessionId: string): boolean {
        const session = this.sessions[sessionId];
        if (!session) {
            return true; // Session doesn't exist, consider it expired
        }

        const timeout = session.deviceType === 'mobile' ? MOBILE_TIMEOUT_MS : WEB_TIMEOUT_MS;
        const now = new Date();
        const lastActivity = new Date(session.lastActivity);
        const timeSinceActivity = now.getTime() - lastActivity.getTime();

        return timeSinceActivity > timeout;
    }

    /**
     * Check if warning should be sent (2 minutes before expiration)
     */
    shouldSendWarning(sessionId: string): boolean {
        const session = this.sessions[sessionId];
        if (!session || session.warningSent) {
            return false;
        }

        const timeout = session.deviceType === 'mobile' ? MOBILE_TIMEOUT_MS : WEB_TIMEOUT_MS;
        const warningTime = timeout - WARNING_THRESHOLD_MS;
        const now = new Date();
        const lastActivity = new Date(session.lastActivity);
        const timeSinceActivity = now.getTime() - lastActivity.getTime();

        if (timeSinceActivity >= warningTime) {
            session.warningSent = true;
            return true;
        }

        return false;
    }

    /**
     * Get time remaining until timeout
     */
    getTimeRemaining(sessionId: string): number {
        const session = this.sessions[sessionId];
        if (!session) {
            return 0;
        }

        const timeout = session.deviceType === 'mobile' ? MOBILE_TIMEOUT_MS : WEB_TIMEOUT_MS;
        const now = new Date();
        const lastActivity = new Date(session.lastActivity);
        const timeSinceActivity = now.getTime() - lastActivity.getTime();
        const timeRemaining = timeout - timeSinceActivity;

        return Math.max(0, timeRemaining);
    }

    /**
     * Clean up expired sessions
     */
    private cleanupExpiredSessions(): void {
        const expiredSessions: string[] = [];

        for (const sessionId in this.sessions) {
            if (this.isSessionExpired(sessionId)) {
                expiredSessions.push(sessionId);
            }
        }

        // Remove expired sessions
        expiredSessions.forEach(sessionId => {
            this.removeSession(sessionId);
        });

        // Log cleanup statistics if any sessions were removed
        if (expiredSessions.length > 0) {
            appLogger.info({ count: expiredSessions.length }, '[SessionManager] Cleaned up expired sessions');
        }
    }

    /**
     * Get session statistics
     */
    getStats(): {
        totalSessions: number;
        webSessions: number;
        mobileSessions: number;
        expiredSessions: number;
    } {
        const sessionEntries = Object.entries(this.sessions);
        const sessions = sessionEntries.map(([, s]) => s);
        const webSessions = sessions.filter(s => s.deviceType === 'web').length;
        const mobileSessions = sessions.filter(s => s.deviceType === 'mobile').length;
        const expiredSessions = sessionEntries.filter(
            ([sessionId]) => this.isSessionExpired(sessionId)
        ).length;

        return {
            totalSessions: sessions.length,
            webSessions,
            mobileSessions,
            expiredSessions,
        };
    }
}

// Create singleton instance
const sessionManager = new SessionManager();

/**
 * Generate session ID from request
 */
function generateSessionId(request: FastifyRequest): string {
    const authHeader = request.headers.authorization;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ipAddress = getClientIp(request);
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Use a hash of token + user agent + IP for session identification
        return `${token.substring(0, 16)}:${userAgent}:${ipAddress}`;
    }
    
    // Fallback for requests without auth token
    return `${ipAddress}:${userAgent}:${Date.now()}`;
}

/**
 * Determine device type from user agent
 */
function determineDeviceType(userAgent?: string): 'web' | 'mobile' {
    if (!userAgent) return 'web';
    
    const mobileIndicators = [
        'mobile', 'android', 'iphone', 'ipad', 'ipod', 'windows phone',
        'blackberry', 'bb10', 'webos', 'opera mini', 'opera mobi'
    ];
    
    const lowerUserAgent = userAgent.toLowerCase();
    const isMobile = mobileIndicators.some(indicator => 
        lowerUserAgent.includes(indicator)
    );
    
    return isMobile ? 'mobile' : 'web';
}

/**
 * Get client IP address
 */
function getClientIp(request: FastifyRequest): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0]?.trim() || request.ip;
    }
    return request.ip;
}

/**
 * Automatic logoff middleware for Fastify
 */
export async function automaticLogoffMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const logger = request.log;
    const userId = request.userId;
    const userAgent = request.headers['user-agent'];
    const ipAddress = getClientIp(request);
    
    // Skip logoff for public endpoints
    const publicPaths = ['/health', '/api/health', '/api/auth/login', '/api/auth/register'];
    if (publicPaths.some(path => request.url.includes(path))) {
        return;
    }
    
    // Skip if no authenticated user
    if (!userId) {
        return;
    }
    
    const sessionId = generateSessionId(request);
    const deviceType = determineDeviceType(userAgent);
    
    try {
        // Check if session exists, create if not
        let session = sessionManager.getSession(sessionId);
        if (!session) {
            sessionManager.createSession(sessionId, userId, deviceType, ipAddress, userAgent || 'unknown');
            logger.info({
                userId,
                sessionId,
                deviceType,
                ipAddress,
            }, 'Created new session for automatic logoff tracking');
        } else {
            // Update activity timestamp
            sessionManager.updateActivity(sessionId);
            
            // Check if session is expired
            if (sessionManager.isSessionExpired(sessionId)) {
                // Log the automatic logoff event
                await logAutomaticLogoff(request, session, 'timeout');
                
                // Remove expired session
                sessionManager.removeSession(sessionId);
                
                // Send timeout response
                logger.warn({
                    userId,
                    sessionId,
                    deviceType,
                    lastActivity: session.lastActivity,
                }, 'Session expired due to inactivity - automatic logoff');
                
                return reply.status(440).send({
                    statusCode: 440,
                    error: 'Session Expired',
                    message: 'Your session has expired due to inactivity. Please log in again.',
                    logoutReason: 'timeout',
                    timeoutMinutes: deviceType === 'mobile' ? 5 : 15,
                });
            }
            
            // Check if warning should be sent
            if (sessionManager.shouldSendWarning(sessionId)) {
                const timeRemaining = sessionManager.getTimeRemaining(sessionId);
                logger.info({
                    userId,
                    sessionId,
                    timeRemaining,
                }, 'Sending session timeout warning');
                
                // Set warning header for frontend to handle
                reply.header('X-Session-Warning', 'true');
                reply.header('X-Session-Time-Remaining', timeRemaining.toString());
            }
        }
        
        // Store session info in request for later use
        request.sessionId = sessionId;
        request.sessionTimeout = deviceType === 'mobile' ? 5 * 60 * 1000 : 15 * 60 * 1000;
        
    } catch (error) {
        logger.error({
            error,
            userId,
            sessionId,
        }, 'Error in automatic logoff middleware');
        // Don't fail the request due to logoff middleware errors
    }
}

/**
 * Log automatic logoff event to audit log
 */
async function logAutomaticLogoff(
    request: FastifyRequest,
    session: SessionData,
    reason: 'timeout' | 'manual' | 'security'
): Promise<void> {
    try {
        const auditLogModule = await import('./auditLog.js');
        
        await auditLogModule.createAuditLog(request, {
            action: 'UPDATE',
            entityType: 'Profile', // Using Profile as the entity type for session management
            entityId: session.userId,
            metadata: {
                event: 'automatic_logoff',
                reason,
                deviceType: session.deviceType,
                lastActivity: session.lastActivity,
                ipAddress: session.ipAddress,
                sessionDuration: new Date().getTime() - session.lastActivity.getTime(),
            },
        });
    } catch (error) {
        request.log.error({ error }, 'Failed to log automatic logoff event');
    }
}

/**
 * Manually log off a session (for logout endpoints)
 */
export function manualLogoff(sessionId: string): void {
    const session = sessionManager.getSession(sessionId);
    if (session) {
        sessionManager.removeSession(sessionId);
        appLogger.info({ userId: session.userId }, '[SessionManager] Manual logoff');
    }
}

/**
 * Get session statistics for monitoring
 */
export function getSessionStats() {
    return sessionManager.getStats();
}

/**
 * Clean up session manager (for testing and graceful shutdown)
 */
export function cleanupSessionManager(): void {
    sessionManager.stopCleanupInterval();
}

export default {
    automaticLogoffMiddleware,
    manualLogoff,
    getSessionStats,
    cleanupSessionManager,
    sessionManager, // Export for testing purposes
};