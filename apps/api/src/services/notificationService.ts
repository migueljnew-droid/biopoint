import { prisma } from '@biopoint/db';
import { accountLockoutConfig } from '../middleware/rateLimit.js';
import { appLogger } from '../utils/appLogger.js';

export interface NotificationConfig {
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromAddress: string;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
  };
}

export interface NotificationData {
  type: 'account_lockout' | 'security_alert' | 'rate_limit_exceeded';
  userId?: string;
  email?: string;
  ipAddress: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  /**
   * Send notification for account lockout
   */
  async sendAccountLockoutNotification(data: NotificationData): Promise<void> {
    if (!data.email) {
      appLogger.warn('No email provided for account lockout notification');
      return;
    }

    const subject = 'BioPoint Security Alert: Account Temporarily Locked';
    const message = this.generateAccountLockoutMessage(data);

    try {
      // Send email notification
      if (this.config.email.enabled) {
        await this.sendEmail(data.email, subject, message);
      }

      // Send Slack notification if configured
      if (this.config.slack?.enabled) {
        await this.sendSlackNotification({
          type: 'account_lockout',
          message: `Account lockout for ${data.email} from IP ${data.ipAddress}`,
          data,
        });
      }

      // Log the notification
      appLogger.info({ email: data.email, ipAddress: data.ipAddress }, 'Account lockout notification sent');
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to send account lockout notification');
      // Don't throw - notification failures shouldn't block the main flow
    }
  }

  /**
   * Send security alert notification
   */
  async sendSecurityAlertNotification(data: NotificationData): Promise<void> {
    const subject = 'BioPoint Security Alert: Suspicious Activity Detected';
    const message = this.generateSecurityAlertMessage(data);

    try {
      if (this.config.email.enabled && data.email) {
        await this.sendEmail(data.email, subject, message);
      }

      if (this.config.slack?.enabled) {
        await this.sendSlackNotification({
          type: 'security_alert',
          message: `Security alert: ${data.type} for ${data.email || data.userId} from IP ${data.ipAddress}`,
          data,
        });
      }
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to send security alert notification');
    }
  }

  /**
   * Generate account lockout email message
   */
  private generateAccountLockoutMessage(data: NotificationData): string {
    const lockoutDuration = 15; // minutes
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@biopoint.com';
    
    return `
Dear BioPoint User,

We have detected multiple failed login attempts to your BioPoint account and have temporarily locked your account for security purposes.

**Account Details:**
- Email: ${data.email}
- Lockout Time: ${data.timestamp.toLocaleString()}
- IP Address: ${data.ipAddress}
- Lockout Duration: ${lockoutDuration} minutes

**What This Means:**
Your account has been temporarily locked due to ${accountLockoutConfig.maxAttempts} consecutive failed login attempts. This is a security measure to protect your account from unauthorized access.

**Next Steps:**
1. Wait ${lockoutDuration} minutes before attempting to log in again
2. Ensure you are using the correct email and password
3. If you have forgotten your password, use the password reset feature
4. If you did not make these login attempts, please contact our support team immediately

**Security Recommendations:**
- Use a strong, unique password
- Enable two-factor authentication when available
- Monitor your account for any suspicious activity
- Never share your login credentials with anyone

If you believe this lockout was made in error or you need immediate assistance, please contact our support team at ${supportEmail}.

The lockout will automatically expire at ${new Date(Date.now() + lockoutDuration * 60 * 1000).toLocaleString()}.

Best regards,
The BioPoint Security Team

---
This is an automated security notification. Please do not reply to this email.
    `.trim();
  }

  /**
   * Generate security alert email message
   */
  private generateSecurityAlertMessage(data: NotificationData): string {
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@biopoint.com';
    
    return `
Dear BioPoint User,

We have detected suspicious activity on your BioPoint account that may require your attention.

**Alert Details:**
- Alert Type: ${data.type}
- Email: ${data.email || 'N/A'}
- Timestamp: ${data.timestamp.toLocaleString()}
- IP Address: ${data.ipAddress}

**What This Means:**
Our security systems have detected unusual activity that may indicate potential unauthorized access or abuse of your account.

**Recommended Actions:**
1. Review your recent account activity
2. Change your password immediately if you suspect unauthorized access
3. Check for any unauthorized changes to your account
4. Contact our support team if you have any concerns

**Security Best Practices:**
- Use strong, unique passwords
- Enable two-factor authentication when available
- Regularly monitor your account activity
- Be cautious of phishing attempts

If you have any questions or concerns about this alert, please contact our support team at ${supportEmail}.

Best regards,
The BioPoint Security Team

---
This is an automated security notification. Please do not reply to this email.
    `.trim();
  }

  /**
   * Send email notification
   */
  private async sendEmail(to: string, subject: string, message: string): Promise<void> {
    // In a production environment, this would integrate with an email service
    // For now, we'll log the email that would be sent
    
    appLogger.info({ to, subject, message }, 'EMAIL NOTIFICATION');

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // Example implementation:
    /*
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: this.config.email.smtpHost,
      port: this.config.email.smtpPort,
      secure: true,
      auth: {
        user: this.config.email.smtpUser,
        pass: this.config.email.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: this.config.email.fromAddress,
      to,
      subject,
      text: message,
    });
    */
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(data: {
    type: string;
    message: string;
    data: NotificationData;
  }): Promise<void> {
    if (!this.config.slack?.enabled) return;

    const payload = {
      channel: this.config.slack.channel,
      username: 'BioPoint Security Bot',
      icon_emoji: ':warning:',
      attachments: [
        {
          color: data.type === 'account_lockout' ? 'warning' : 'danger',
          fields: [
            {
              title: 'Alert Type',
              value: data.type,
              short: true,
            },
            {
              title: 'Email',
              value: data.data.email || 'N/A',
              short: true,
            },
            {
              title: 'IP Address',
              value: data.data.ipAddress,
              short: true,
            },
            {
              title: 'Timestamp',
              value: data.data.timestamp.toISOString(),
              short: true,
            },
          ],
          footer: 'BioPoint Security System',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      const response = await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      appLogger.info('Slack notification sent successfully');
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to send Slack notification');
      throw error;
    }
  }

  /**
   * Log security event to database
   */
  async logSecurityEvent(data: NotificationData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: 'SECURITY_EVENT',
          entityType: 'Security',
          entityId: data.type,
          metadata: {
            eventType: data.type,
            ipAddress: data.ipAddress,
            email: data.email,
            ...data.metadata,
          },
          ipAddress: data.ipAddress,
        },
      });
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to log security event');
      // Don't throw - logging failure shouldn't break the main flow
    }
  }
}

// Default notification service instance
export const createNotificationService = (): NotificationService => {
  const config: NotificationConfig = {
    email: {
      enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER || '',
      smtpPassword: process.env.SMTP_PASSWORD || '',
      fromAddress: process.env.FROM_EMAIL || 'security@biopoint.com',
    },
    slack: {
      enabled: process.env.SLACK_NOTIFICATIONS_ENABLED === 'true',
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: process.env.SLACK_CHANNEL || '#security-alerts',
    },
  };

  return new NotificationService(config);
};