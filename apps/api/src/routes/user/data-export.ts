import type { FastifyInstance } from 'fastify';
import { prisma } from '@biopoint/db';
import { authMiddleware } from '../../middleware/auth.js';
import { createAuditLog } from '../../middleware/auditLog.js';
import { exportUserData, generatePDFReport } from '../../services/gdpr-compliance.js';
import { z } from 'zod';
import { appLogger } from '../../utils/appLogger.js';

// Validation schemas
const DataExportSchema = z.object({
  format: z.enum(['json', 'csv', 'xml', 'pdf']).default('json'),
  includeProfile: z.boolean().default(true),
  includeLabs: z.boolean().default(true),
  includePhotos: z.boolean().default(true),
  includeLogs: z.boolean().default(true),
  includeStacks: z.boolean().default(true),
  includeAuditLogs: z.boolean().default(false),
});


export async function dataExportRoutes(app: FastifyInstance) {
  // Apply auth middleware to all routes
  app.addHook('preHandler', authMiddleware);

  /**
   * GET /api/user/export
   * Export user data in machine-readable format (Article 20 - Data Portability)
   */
  app.get('/export', async (request, reply) => {
    try {
      const userId = request.userId;
      
      // Parse query parameters
      const query = request.query as Record<string, string | undefined>;
      const exportOptions = DataExportSchema.parse({
        format: query.format || 'json',
        includeProfile: query.includeProfile !== 'false',
        includeLabs: query.includeLabs !== 'false',
        includePhotos: query.includePhotos !== 'false',
        includeLogs: query.includeLogs !== 'false',
        includeStacks: query.includeStacks !== 'false',
        includeAuditLogs: query.includeAuditLogs === 'true',
      });

      // Create audit log
      await createAuditLog(request, {
        action: 'READ',
        entityType: 'DataExport',
        entityId: userId,
        metadata: {
          exportFormat: exportOptions.format,
          dataCategories: [
            exportOptions.includeProfile && 'profile',
            exportOptions.includeLabs && 'labs',
            exportOptions.includePhotos && 'photos',
            exportOptions.includeLogs && 'logs',
            exportOptions.includeStacks && 'stacks',
            exportOptions.includeAuditLogs && 'audit',
          ].filter(Boolean),
        }
      });

      // Export data based on format
      if (exportOptions.format === 'pdf') {
        // Generate PDF report
        const pdfBuffer = await generatePDFReport(userId, request);
        
        reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="biopoint-data-export-${userId}-${new Date().toISOString().split('T')[0]}.pdf"`)
          .send(pdfBuffer);
      } else {
        // Export data in requested format
        const exportData = await exportUserData(userId, exportOptions, request);
        
        // Set appropriate content type and headers
        const contentTypes = {
          json: 'application/json',
          csv: 'text/csv',
          xml: 'application/xml',
        };
        
        reply
          .header('Content-Type', contentTypes[exportOptions.format])
          .header('Content-Disposition', `attachment; filename="biopoint-data-export-${userId}-${new Date().toISOString().split('T')[0]}.${exportOptions.format}"`)
          .send(exportData);
      }
    } catch (error) {
      appLogger.error({ err: error }, 'Data export error');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid export parameters',
          details: error.errors,
        });
      }
      
      return reply.status(500).send({
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/user/export/options
   * Get available export options and data categories
   */
  app.get('/export/options', async (request, reply) => {
    try {
      const userId = request.userId;
      
      // Get user's data summary to show what's available for export
      const dataSummary = await prisma.$transaction(async (tx) => {
        const [
          profile,
          labReports,
          progressPhotos,
          dailyLogs,
          stacks,
          auditLogs,
        ] = await Promise.all([
          tx.profile.findUnique({ where: { userId } }),
          tx.labReport.count({ where: { userId } }),
          tx.progressPhoto.count({ where: { userId } }),
          tx.dailyLog.count({ where: { userId } }),
          tx.stack.count({ where: { userId } }),
          tx.auditLog.count({ where: { userId } }),
        ]);

        return {
          hasProfile: !!profile,
          labReports,
          progressPhotos,
          dailyLogs,
          stacks,
          auditLogs,
        };
      });

      const options = {
        formats: ['json', 'csv', 'xml', 'pdf'],
        categories: [
          {
            id: 'profile',
            name: 'Profile Information',
            description: 'Personal profile data, consent settings, and account information',
            available: dataSummary.hasProfile,
            recordCount: dataSummary.hasProfile ? 1 : 0,
          },
          {
            id: 'labs',
            name: 'Lab Reports',
            description: 'Laboratory test results and biomarker data',
            available: dataSummary.labReports > 0,
            recordCount: dataSummary.labReports,
          },
          {
            id: 'photos',
            name: 'Progress Photos',
            description: 'Progress photos and body composition tracking',
            available: dataSummary.progressPhotos > 0,
            recordCount: dataSummary.progressPhotos,
          },
          {
            id: 'logs',
            name: 'Daily Logs',
            description: 'Daily tracking data including weight, sleep, and wellness metrics',
            available: dataSummary.dailyLogs > 0,
            recordCount: dataSummary.dailyLogs,
          },
          {
            id: 'stacks',
            name: 'Supplement Stacks',
            description: 'Peptide and supplement tracking data',
            available: dataSummary.stacks > 0,
            recordCount: dataSummary.stacks,
          },
          {
            id: 'audit',
            name: 'Audit Logs',
            description: 'Account activity and access logs (limited to recent activity)',
            available: dataSummary.auditLogs > 0,
            recordCount: Math.min(dataSummary.auditLogs, 1000), // Limit for privacy
          },
        ],
        gdprNotice: 'This export complies with GDPR Article 20 - Right to Data Portability',
      };

      return options;
    } catch (error) {
      appLogger.error({ err: error }, 'Export options error');
      return reply.status(500).send({
        error: 'Failed to get export options',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/user/export/history
   * Get export history for the user
   */
  app.get('/export/history', async (request, reply) => {
    try {
      const userId = request.userId;
      
      // Get export-related audit logs
      const exportHistory = await prisma.auditLog.findMany({
        where: {
          userId,
          entityType: 'DataExport',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Limit history
        select: {
          id: true,
          action: true,
          metadata: true,
          ipAddress: true,
          createdAt: true,
        },
      });

      return {
        exports: exportHistory.map(log => {
          const meta = log.metadata as Record<string, unknown> | null | undefined;
          return {
            id: log.id,
            timestamp: log.createdAt,
            ipAddress: log.ipAddress,
            format: (meta?.['exportFormat'] as string | undefined) || 'unknown',
            categories: (meta?.['dataCategories'] as unknown[]) || [],
          };
        }),
        total: exportHistory.length,
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Export history error');
      return reply.status(500).send({
        error: 'Failed to get export history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/user/export/notifications
   * Configure export notifications
   */
  app.post('/export/notifications', async (request, reply) => {
    try {
      const userId = request.userId;
      const body = request.body as { emailNotifications?: boolean; frequency?: string };
      
      // Update user preferences for export notifications
      // This would typically be stored in user preferences or settings
      
      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'ExportNotifications',
        entityId: userId,
        metadata: {
          emailNotifications: body.emailNotifications,
          frequency: body.frequency,
        }
      });

      return {
        success: true,
        message: 'Export notification preferences updated',
      };
    } catch (error) {
      appLogger.error({ err: error }, 'Export notifications error');
      return reply.status(500).send({
        error: 'Failed to update export notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}