import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../../middleware/auth.js';
import { createAuditLog } from '../../middleware/auditLog.js';
import {
  requestAccountDeletion,
  getDeletionStatus,
  updateConsentPreferences,
  getConsentPreferences
} from '../../services/gdpr-compliance.js';
import { z } from 'zod';
import { appLogger } from '../../utils/appLogger.js';

// Validation schemas
const AccountDeletionRequestSchema = z.object({
  reason: z.string().optional(),
  confirmationEmail: z.string().email(),
  immediateEffect: z.boolean().default(false),
  passwordConfirmation: z.string().min(1),
});

const ConsentUpdateSchema = z.object({
  marketing: z.boolean(),
  analytics: z.boolean(),
  research: z.boolean(),
  thirdPartySharing: z.boolean(),
});

const ConsentWithdrawalSchema = z.object({
  consentType: z.enum(['marketing', 'analytics', 'research', 'thirdPartySharing', 'all']),
  reason: z.string().optional(),
});

export async function accountDeletionRoutes(app: FastifyInstance) {
  // Apply auth middleware to all routes
  app.addHook('preHandler', authMiddleware);

  /**
   * POST /api/user/delete-account
   * Request account deletion (Article 17 - Right to Erasure)
   */
  app.post('/delete-account', async (request, reply) => {
    try {
      const userId = request.userId;
      const body = AccountDeletionRequestSchema.parse(request.body);

      // Verify user exists and get current data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              labReports: true,
              progressPhotos: true,
              dailyLogs: true,
              stacks: true,
            }
          }
        }
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found',
        });
      }

      // Verify email matches
      if (user.email !== body.confirmationEmail) {
        return reply.status(400).send({
          error: 'Email confirmation failed',
          message: 'The email provided does not match your account email',
        });
      }

      // Check for existing pending deletion request
      const existingRequest = await prisma.deletionRequest.findFirst({
        where: {
          userId,
          status: 'PENDING',
        }
      });

      if (existingRequest) {
        return reply.status(400).send({
          error: 'Account deletion already requested',
          message: `You have already requested account deletion. Your account is scheduled for deletion on ${existingRequest.scheduledFor.toISOString().split('T')[0]}.`,
        });
      }

      // Create deletion request
      const deletionResult = await requestAccountDeletion({
        userId,
        reason: body.reason,
        confirmationEmail: body.confirmationEmail,
        immediateEffect: body.immediateEffect,
      }, request);

      // Create audit log
      await createAuditLog(request, {
        action: 'CREATE',
        entityType: 'AccountDeletionRequest',
        entityId: deletionResult.deletionId,
        metadata: {
          userId,
          reason: body.reason,
          immediateEffect: body.immediateEffect,
          scheduledFor: deletionResult.scheduledFor,
        }
      });

      return {
        success: true,
        message: 'Account deletion request submitted successfully',
        deletionId: deletionResult.deletionId,
        scheduledFor: deletionResult.scheduledFor,
        immediateEffect: body.immediateEffect,
        warning: body.immediateEffect 
          ? 'Your account has been disabled. You will not be able to log in until deletion is complete.'
          : 'Your account will be deleted in 30 days. You can cancel this request until then.',
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Account deletion request error');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid request parameters',
          details: error.errors,
        });
      }
      
      return reply.status(500).send({
        error: 'Failed to process account deletion request',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/user/delete-account/status
   * Get account deletion status
   */
  app.get('/delete-account/status', async (request, reply) => {
    try {
      const userId = request.userId;
      
      const deletionStatus = await getDeletionStatus(userId);
      
      return deletionStatus;
    } catch (error) {
      appLogger.error({ err: error }, 'Deletion status error');
      return reply.status(500).send({
        error: 'Failed to get deletion status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /api/user/delete-account/:deletionId
   * Cancel account deletion request
   */
  app.delete('/delete-account/:deletionId', async (request, reply) => {
    try {
      const userId = request.userId;
      const { deletionId } = request.params as { deletionId: string };

      // Find the deletion request
      const deletionRequest = await prisma.deletionRequest.findUnique({
        where: { id: deletionId }
      });

      if (!deletionRequest) {
        return reply.status(404).send({
          error: 'Deletion request not found',
        });
      }

      if (deletionRequest.userId !== userId) {
        return reply.status(403).send({
          error: 'Unauthorized',
          message: 'You can only cancel your own deletion requests',
        });
      }

      if (deletionRequest.status !== 'PENDING') {
        return reply.status(400).send({
          error: 'Cannot cancel deletion request',
          message: `This deletion request is already ${deletionRequest.status.toLowerCase()}`,
        });
      }

      // Cancel the deletion request
      const cancelledRequest = await prisma.deletionRequest.update({
        where: { id: deletionId },
        data: {
          status: 'CANCELLED',
        }
      });

      // Create audit log
      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'AccountDeletionRequest',
        entityId: deletionId,
        metadata: {
          userId,
          action: 'CANCELLED',
          previousStatus: 'PENDING',
          newStatus: 'CANCELLED',
        }
      });

      return {
        success: true,
        message: 'Account deletion request cancelled successfully',
        deletionId: cancelledRequest.id,
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Cancel deletion error');
      return reply.status(500).send({
        error: 'Failed to cancel deletion request',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/user/consent
   * Get current consent preferences
   */
  app.get('/consent', async (request, reply) => {
    try {
      const userId = request.userId;
      
      const consentPreferences = await getConsentPreferences(userId);
      
      return {
        consent: consentPreferences,
        gdprNotice: 'You have the right to withdraw consent at any time',
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Get consent error');
      return reply.status(500).send({
        error: 'Failed to get consent preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PUT /api/user/consent
   * Update consent preferences
   */
  app.put('/consent', async (request, reply) => {
    try {
      const userId = request.userId;
      const body = ConsentUpdateSchema.parse(request.body);

      const result = await updateConsentPreferences({
        userId,
        ...body,
      }, request);

      return {
        success: true,
        message: 'Consent preferences updated successfully',
        consent: {
          marketing: body.marketing,
          analytics: body.analytics,
          research: body.research,
          thirdPartySharing: body.thirdPartySharing,
          updatedAt: result.consentRecord.changedAt,
        },
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Update consent error');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid consent parameters',
          details: error.errors,
        });
      }
      
      return reply.status(500).send({
        error: 'Failed to update consent preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/user/consent/withdraw
   * Withdraw consent (Article 7 - Conditions for consent)
   */
  app.post('/consent/withdraw', async (request, reply) => {
    try {
      const userId = request.userId;
      const body = ConsentWithdrawalSchema.parse(request.body);

      // Get current consent preferences
      const currentConsent = await getConsentPreferences(userId);

      // Update consent based on withdrawal request
      let updatedConsent = { ...currentConsent };
      
      if (body.consentType === 'all') {
        updatedConsent = {
          marketing: false,
          analytics: false,
          research: false,
          thirdPartySharing: false,
        };
      } else {
        updatedConsent[body.consentType] = false;
      }

      await updateConsentPreferences({
        userId,
        ...updatedConsent,
      }, request);

      // Create audit log for consent withdrawal
      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'ConsentWithdrawal',
        entityId: userId,
        metadata: {
          consentType: body.consentType,
          reason: body.reason,
          previousConsent: currentConsent,
          newConsent: updatedConsent,
        }
      });

      return {
        success: true,
        message: 'Consent withdrawn successfully',
        consent: updatedConsent,
        gdprNotice: 'Your consent has been withdrawn. This will not affect the lawfulness of processing based on consent before its withdrawal.',
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Consent withdrawal error');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid withdrawal parameters',
          details: error.errors,
        });
      }
      
      return reply.status(500).send({
        error: 'Failed to withdraw consent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/user/consent/history
   * Get consent history
   */
  app.get('/consent/history', async (request, reply) => {
    try {
      const userId = request.userId;
      
      const consentHistory = await prisma.consentRecord.findMany({
        where: { userId },
        orderBy: { changedAt: 'desc' },
        take: 50, // Limit history
        select: {
          id: true,
          marketing: true,
          analytics: true,
          research: true,
          thirdPartySharing: true,
          changedAt: true,
          ipAddress: true,
        },
      });

      return {
        consentHistory: consentHistory.map(record => ({
          id: record.id,
          timestamp: record.changedAt,
          ipAddress: record.ipAddress,
          preferences: {
            marketing: record.marketing,
            analytics: record.analytics,
            research: record.research,
            thirdPartySharing: record.thirdPartySharing,
          },
        })),
        total: consentHistory.length,
        gdprNotice: 'Consent history is maintained for compliance with GDPR Article 7',
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Consent history error');
      return reply.status(500).send({
        error: 'Failed to get consent history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/user/data-retention-policy
   * Get data retention policy information
   */
  app.get('/data-retention-policy', async (request, reply) => {
    try {
      const userId = request.userId;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found',
        });
      }

      const sevenYearsFromCreation = new Date(user.createdAt);
      sevenYearsFromCreation.setFullYear(sevenYearsFromCreation.getFullYear() + 7);

      const sevenYearsFromUpdate = new Date(user.updatedAt);
      sevenYearsFromUpdate.setFullYear(sevenYearsFromUpdate.getFullYear() + 7);

      return {
        policy: {
          inactiveAccountDeletion: '7 years from last activity',
          medicalRecordRetention: '7 years (legal requirement)',
          marketingDataRetention: '2 years or until consent withdrawal',
          analyticsDataRetention: '24 months (anonymized after 12 months)',
          logDataRetention: '24 months (security logs retained 7 years)',
          backupDataRetention: '30 days (encrypted backups)',
        },
        userData: {
          accountCreated: user.createdAt,
          lastUpdated: user.updatedAt,
          scheduledDeletionDate: sevenYearsFromUpdate > sevenYearsFromCreation ? sevenYearsFromUpdate : sevenYearsFromCreation,
          yearsUntilDeletion: Math.ceil((Math.max(sevenYearsFromUpdate.getTime(), sevenYearsFromCreation.getTime()) - Date.now()) / (365 * 24 * 60 * 60 * 1000)),
        },
        gdprNotice: 'This data retention policy complies with GDPR Article 5(1)(e) - Storage limitation principle',
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Data retention policy error');
      return reply.status(500).send({
        error: 'Failed to get data retention policy',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}