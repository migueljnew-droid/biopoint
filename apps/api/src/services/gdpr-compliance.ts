import { prisma } from '@biopoint/db';
import { createAuditLog } from '../middleware/auditLog.js';
import crypto from 'crypto';

/**
 * GDPR Compliance Service
 * Implements Articles 17 (Right to Erasure) and 20 (Data Portability)
 * with enhanced consent management and data retention policies
 */

export interface DataExportOptions {
  format: 'json' | 'csv' | 'xml' | 'pdf';
  includeProfile: boolean;
  includeLabs: boolean;
  includePhotos: boolean;
  includeLogs: boolean;
  includeStacks: boolean;
  includeAuditLogs: boolean;
}

export interface AccountDeletionRequest {
  userId: string;
  reason?: string;
  confirmationEmail: string;
  immediateEffect: boolean;
}

export interface ConsentUpdate {
  userId: string;
  marketing: boolean;
  analytics: boolean;
  research: boolean;
  thirdPartySharing: boolean;
}

/**
 * Export user data in machine-readable format (Article 20 - Right to Data Portability)
 */
export async function exportUserData(
  userId: string, 
  options: DataExportOptions,
  request?: any
): Promise<any> {
  try {
    // Fetch user data based on selected options
    const exportData: any = {
      exportDate: new Date().toISOString(),
      userId,
      version: '1.0',
      gdprCompliant: true,
    };

    // Profile data
    if (options.includeProfile) {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            }
          }
        }
      });
      exportData.profile = profile;
    }

    // Lab reports and markers
    if (options.includeLabs) {
      const labReports = await prisma.labReport.findMany({
        where: { userId },
        orderBy: { uploadedAt: 'desc' },
        include: {
          markers: {
            select: {
              id: true,
              name: true,
              value: true,
              unit: true,
              refRangeLow: true,
              refRangeHigh: true,
              recordedAt: true,
              notes: true,
            }
          }
        }
      });
      exportData.labReports = labReports;
    }

    // Progress photos
    if (options.includePhotos) {
      const photos = await prisma.progressPhoto.findMany({
        where: { userId },
        orderBy: { capturedAt: 'desc' },
        select: {
          id: true,
          category: true,
          capturedAt: true,
          weightKg: true,
          notes: true,
          alignmentStatus: true,
          createdAt: true,
        }
      });
      exportData.progressPhotos = photos;
    }

    // Daily logs
    if (options.includeLogs) {
      const logs = await prisma.dailyLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          weightKg: true,
          sleepHours: true,
          sleepQuality: true,
          energyLevel: true,
          focusLevel: true,
          moodLevel: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        }
      });
      exportData.dailyLogs = logs;
    }

    // Stacks and supplements
    if (options.includeStacks) {
      const stacks = await prisma.stack.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            select: {
              id: true,
              name: true,
              dose: true,
              unit: true,
              route: true,
              frequency: true,
              timing: true,
              cycleJson: true,
              notes: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            }
          }
        }
      });
      exportData.stacks = stacks;
    }

    // Audit logs (limited PHI exposure)
    if (options.includeAuditLogs) {
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
        take: 1000, // Limit for privacy
      });
      exportData.auditLogs = auditLogs;
    }

    // Create audit log for export
    if (request) {
      await createAuditLog(request, {
        action: 'READ',
        entityType: 'DataExport',
        entityId: userId,
        metadata: {
          exportFormat: options.format,
          dataCategories: Object.keys(options).filter(key => options[key as keyof DataExportOptions] === true && key !== 'format'),
        }
      });
    }

    return exportData;
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error exporting user data:', error);
    }
    throw new Error('Failed to export user data');
  }
}

/**
 * Generate human-readable PDF report
 */
export async function generatePDFReport(
  userId: string,
  request?: any
): Promise<Buffer> {
  try {
    const exportData = await exportUserData(userId, {
      format: 'pdf',
      includeProfile: true,
      includeLabs: true,
      includePhotos: true,
      includeLogs: true,
      includeStacks: true,
      includeAuditLogs: false,
    }, request);

    // For now, return a simple JSON representation that can be converted to PDF
    // In production, integrate with a PDF generation library like puppeteer or pdf-lib
    const pdfContent = {
      title: 'BioPoint Personal Data Report',
      generatedAt: new Date().toISOString(),
      userId,
      sections: {
        profile: exportData.profile,
        labReports: exportData.labReports,
        progressPhotos: exportData.progressPhotos,
        dailyLogs: exportData.dailyLogs,
        stacks: exportData.stacks,
      },
      disclaimer: 'This report contains your personal data as requested under Article 20 of the GDPR.',
      gdprNotice: 'Generated in compliance with GDPR Article 20 - Right to Data Portability',
    };

    return Buffer.from(JSON.stringify(pdfContent, null, 2));
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error generating PDF report:', error);
    }
    throw new Error('Failed to generate PDF report');
  }
}

/**
 * Request account deletion (Article 17 - Right to Erasure)
 */
export async function requestAccountDeletion(
  deletionRequest: AccountDeletionRequest,
  request?: any
): Promise<{ success: boolean; deletionId: string; scheduledFor: Date }> {
  try {
    const { userId, reason, confirmationEmail, immediateEffect } = deletionRequest;

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify email matches
    if (user.email !== confirmationEmail) {
      throw new Error('Email confirmation failed');
    }

    // Check for existing deletion request
    const existingRequest = await prisma.deletionRequest.findFirst({
      where: { 
        userId,
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      throw new Error('Account deletion already requested');
    }

    // Calculate deletion date (30 days from now for grace period)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Create deletion request
    const deletionRequestRecord = await prisma.deletionRequest.create({
      data: {
        userId,
        reason,
        requestedAt: new Date(),
        scheduledFor: deletionDate,
        status: 'PENDING',
        confirmationToken: crypto.randomBytes(32).toString('hex'),
        immediateEffect: immediateEffect || false,
      }
    });

    // If immediate effect requested, disable login immediately
    if (immediateEffect) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          // Keep account but disable login by invalidating refresh tokens
          refreshTokens: {
            deleteMany: {}
          }
        }
      });
    }

    // Create audit log
    if (request) {
      await createAuditLog(request, {
        action: 'DELETE',
        entityType: 'AccountDeletionRequest',
        entityId: deletionRequestRecord.id,
        metadata: {
          userId,
          reason,
          scheduledFor: deletionDate,
          immediateEffect: immediateEffect || false,
        }
      });
    }

    return {
      success: true,
      deletionId: deletionRequestRecord.id,
      scheduledFor: deletionDate,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error requesting account deletion:', error);
    }
    throw error instanceof Error ? error : new Error('Failed to request account deletion');
  }
}

/**
 * Execute account deletion (hard delete after grace period)
 */
export async function executeAccountDeletion(
  deletionRequestId: string,
  request?: any
): Promise<{ success: boolean; deletedRecords: Record<string, number> }> {
  try {
    const deletionRequest = await prisma.deletionRequest.findUnique({
      where: { id: deletionRequestId },
      include: { user: true }
    });

    if (!deletionRequest) {
      throw new Error('Deletion request not found');
    }

    if (deletionRequest.status !== 'PENDING') {
      throw new Error('Deletion request is not pending');
    }

    const userId = deletionRequest.userId;
    const deletedRecords: Record<string, number> = {};

    // Start transaction for atomic deletion
    const result = await prisma.$transaction(async (tx) => {
      // Delete in dependency order to avoid foreign key violations
      
      // 1. Delete compliance events (depend on stack items)
      const complianceEvents = await tx.complianceEvent.deleteMany({
        where: { userId }
      });
      deletedRecords.complianceEvents = complianceEvents.count;

      // 2. Delete reminder schedules (depend on stack items)
      const reminderSchedules = await tx.reminderSchedule.deleteMany({
        where: { userId }
      });
      deletedRecords.reminderSchedules = reminderSchedules.count;

      // 3. Delete stack items (depend on stacks)
      const stackItems = await tx.stackItem.deleteMany({
        where: { stack: { userId } }
      });
      deletedRecords.stackItems = stackItems.count;

      // 4. Delete stacks
      const stacks = await tx.stack.deleteMany({
        where: { userId }
      });
      deletedRecords.stacks = stacks.count;

      // 5. Delete lab markers (depend on lab reports)
      const labMarkers = await tx.labMarker.deleteMany({
        where: { labReport: { userId } }
      });
      deletedRecords.labMarkers = labMarkers.count;

      // 6. Delete lab reports
      const labReports = await tx.labReport.deleteMany({
        where: { userId }
      });
      deletedRecords.labReports = labReports.count;

      // 7. Delete progress photos
      const progressPhotos = await tx.progressPhoto.deleteMany({
        where: { userId }
      });
      deletedRecords.progressPhotos = progressPhotos.count;

      // 8. Delete daily logs
      const dailyLogs = await tx.dailyLog.deleteMany({
        where: { userId }
      });
      deletedRecords.dailyLogs = dailyLogs.count;

      // 9. Delete bio point scores
      const bioPointScores = await tx.bioPointScore.deleteMany({
        where: { userId }
      });
      deletedRecords.bioPointScores = bioPointScores.count;

      // 10. Delete group memberships
      const groupMemberships = await tx.groupMember.deleteMany({
        where: { userId }
      });
      deletedRecords.groupMemberships = groupMemberships.count;

      // 11. Delete posts
      const posts = await tx.post.deleteMany({
        where: { userId }
      });
      deletedRecords.posts = posts.count;

      // 12. Delete download logs
      const downloadLogs = await tx.downloadLog.deleteMany({
        where: { userId }
      });
      deletedRecords.downloadLogs = downloadLogs.count;

      // 13. Delete compliance events for this user
      const userComplianceEvents = await tx.complianceEvent.deleteMany({
        where: { userId }
      });
      deletedRecords.userComplianceEvents = userComplianceEvents.count;

      // 14. Delete profile
      const profile = await tx.profile.deleteMany({
        where: { userId }
      });
      deletedRecords.profile = profile.count;

      // 15. Delete refresh tokens
      const refreshTokens = await tx.refreshToken.deleteMany({
        where: { userId }
      });
      deletedRecords.refreshTokens = refreshTokens.count;

      // 16. Delete audit logs (keep for compliance)
      // Note: We keep audit logs for compliance but anonymize user ID
      await tx.auditLog.updateMany({
        where: { userId },
        data: { 
          userId: null,
          metadata: {
            originalUserId: userId,
            deletedAt: new Date(),
            deletionRequestId: deletionRequestId,
          }
        }
      });

      // 17. Update deletion request
      await tx.deletionRequest.update({
        where: { id: deletionRequestId },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date(),
          deletedRecords
        }
      });

      // 18. Finally, delete the user
      await tx.user.delete({
        where: { id: userId }
      });

      return deletedRecords;
    });

    // Create audit log
    if (request) {
      await createAuditLog(request, {
        action: 'DELETE',
        entityType: 'UserAccount',
        entityId: userId,
        metadata: {
          deletionRequestId,
          deletedRecords: result,
          reason: deletionRequest.reason,
        }
      });
    }

    return {
      success: true,
      deletedRecords: result,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error executing account deletion:', error);
    }
    throw error instanceof Error ? error : new Error('Failed to execute account deletion');
  }
}

/**
 * Update granular consent preferences
 */
export async function updateConsentPreferences(
  consentUpdate: ConsentUpdate,
  request?: any
): Promise<{ success: boolean; consentRecord: any }> {
  try {
    const { userId, marketing, analytics, research, thirdPartySharing } = consentUpdate;

    // Get current profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Update consent preferences
    await prisma.profile.update({
      where: { userId },
      data: {
        consentResearch: research,
        consentResearchAt: research ? new Date() : null,
        // Store additional consent preferences in metadata
        encryption_metadata: {
          ...(profile.encryption_metadata as object | null | undefined),
          consentPreferences: {
            marketing,
            analytics,
            research,
            thirdPartySharing,
            updatedAt: new Date(),
          }
        }
      }
    });

    // Create consent audit record
    const consentRecord = await prisma.consentRecord.create({
      data: {
        userId,
        marketing,
        analytics,
        research,
        thirdPartySharing,
        changedAt: new Date(),
        ipAddress: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      }
    });

    // Create audit log
    if (request) {
      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'ConsentPreferences',
        entityId: userId,
        metadata: {
          marketing,
          analytics,
          research,
          thirdPartySharing,
          previousConsentResearch: profile.consentResearch,
          newConsentResearch: research,
        }
      });
    }

    return {
      success: true,
      consentRecord,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error updating consent preferences:', error);
    }
    throw error instanceof Error ? error : new Error('Failed to update consent preferences');
  }
}

/**
 * Get consent preferences
 */
export async function getConsentPreferences(userId: string): Promise<any> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get latest consent record
    const latestConsent = await prisma.consentRecord.findFirst({
      where: { userId },
      orderBy: { changedAt: 'desc' }
    });

    const encMeta = profile.encryption_metadata as Record<string, unknown> | null | undefined;
    const consentPreferences = (encMeta?.['consentPreferences'] as Record<string, unknown> | undefined) || {};

    return {
      marketing: latestConsent?.marketing ?? consentPreferences.marketing ?? false,
      analytics: latestConsent?.analytics ?? consentPreferences.analytics ?? false,
      research: profile.consentResearch,
      thirdPartySharing: latestConsent?.thirdPartySharing ?? consentPreferences.thirdPartySharing ?? false,
      updatedAt: latestConsent?.changedAt ?? consentPreferences.updatedAt ?? profile.updatedAt,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error getting consent preferences:', error);
    }
    throw error instanceof Error ? error : new Error('Failed to get consent preferences');
  }
}

/**
 * Clean up orphaned data (monthly maintenance)
 */
export async function cleanupOrphanedData(): Promise<{ cleanedRecords: Record<string, number> }> {
  try {
    const cleanedRecords: Record<string, number> = {};

    // Clean up orphaned lab markers
    const orphanedMarkers = await prisma.labMarker.deleteMany({
      where: {
        labReportId: null
      }
    });
    cleanedRecords.orphanedMarkers = orphanedMarkers.count;

    // ComplianceEvent.stackItemId and ReminderSchedule.stackItemId are non-nullable with FK constraints,
    // so "orphaned" rows cannot exist under normal operation. Keep counters for reporting consistency.
    cleanedRecords.orphanedComplianceEvents = 0;
    cleanedRecords.orphanedReminders = 0;

    // Clean up old deletion requests
    const oldDeletionRequests = await prisma.deletionRequest.deleteMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days old
        }
      }
    });
    cleanedRecords.oldDeletionRequests = oldDeletionRequests.count;

    return { cleanedRecords };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error cleaning up orphaned data:', error);
    }
    throw error instanceof Error ? error : new Error('Failed to cleanup orphaned data');
  }
}

/**
 * Auto-delete inactive accounts (7 years)
 */
export async function autoDeleteInactiveAccounts(): Promise<{ deletedAccounts: number; errors: string[] }> {
  try {
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    // Find inactive users
    const inactiveUsers = await prisma.user.findMany({
      where: {
        updatedAt: {
          lt: sevenYearsAgo
        },
        // Exclude users with recent deletion requests
        deletionRequests: {
          none: {
            status: 'PENDING'
          }
        }
      },
      select: {
        id: true,
        email: true,
        updatedAt: true,
      }
    });

    const errors: string[] = [];
    let deletedAccounts = 0;

    // Process each inactive user
    for (const user of inactiveUsers) {
      try {
        // Create deletion request
        await requestAccountDeletion({
          userId: user.id,
          confirmationEmail: user.email,
          immediateEffect: false,
          reason: 'Automatic deletion due to 7-year inactivity policy',
        });

        deletedAccounts++;
      } catch (error) {
        const errorMessage = `Failed to delete account ${user.id}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMessage);
        if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
          console.error(errorMessage);
        }
      }
    }

    return { deletedAccounts, errors };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error auto-deleting inactive accounts:', error);
    }
    throw error instanceof Error ? error : new Error('Failed to auto-delete inactive accounts');
  }
}

/**
 * Get account deletion status
 */
export async function getDeletionStatus(userId: string): Promise<any> {
  try {
    const deletionRequest = await prisma.deletionRequest.findFirst({
      where: { userId },
      orderBy: { requestedAt: 'desc' }
    });

    if (!deletionRequest) {
      return {
        hasPendingDeletion: false,
        status: null,
      };
    }

    return {
      hasPendingDeletion: deletionRequest.status === 'PENDING',
      status: deletionRequest.status,
      requestedAt: deletionRequest.requestedAt,
      scheduledFor: deletionRequest.scheduledFor,
      reason: deletionRequest.reason,
      completedAt: deletionRequest.completedAt,
      deletedRecords: deletionRequest.deletedRecords,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'test' || process.env.VITEST_DEBUG_LOGS) {
      console.error('Error getting deletion status:', error);
    }
    throw error instanceof Error ? error : new Error('Failed to get deletion status');
  }
}
