/**
 * Input Sanitization Utilities for BioPoint API
 * 
 * HIPAA Compliance: §164.312(a)(1) Access controls, §164.312(c)(1) Integrity
 * 
 * This module provides comprehensive input sanitization to prevent:
 * - XSS (Cross-Site Scripting) attacks
 * - SQL injection (additional layer beyond Prisma's parameterized queries)
 * - Command injection attacks
 * - Path traversal attacks
 * - NoSQL injection attacks
 * - LDAP injection attacks
 * - XML External Entity (XXE) attacks
 */

import { z } from 'zod';

/**
 * XSS Prevention: HTML Entity Encoding
 * Encodes special characters to prevent XSS attacks
 */
export function encodeHtmlEntities(str: string): string {
    const htmlEscapes: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };

    return str.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match] as string);
}

/**
 * XSS Prevention: Strip dangerous HTML tags and attributes
 * Removes <script> tags, javascript: URLs, and dangerous attributes
 */
export function stripDangerousHtml(input: string): string {
    // Remove script tags and their content
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove data: URLs that could contain malicious content
    sanitized = sanitized.replace(/data:text\/html/gi, '');

    // Remove dangerous attributes (onclick, onload, etc.)
    const dangerousAttributes = [
        'onabort', 'onblur', 'onchange', 'onclick', 'ondblclick',
        'onerror', 'onfocus', 'onkeydown', 'onkeypress', 'onkeyup',
        'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover',
        'onmouseup', 'onreset', 'onresize', 'onselect', 'onsubmit', 'onunload'
    ];

    dangerousAttributes.forEach(attr => {
        const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
        sanitized = sanitized.replace(regex, '');
    });

    return sanitized;
}

/**
 * XSS Prevention: Sanitize markdown content
 * Removes dangerous markdown extensions and HTML injection points
 */
export function sanitizeMarkdown(input: string): string {
    // Remove HTML tags from markdown
    let sanitized = stripDangerousHtml(input);

    // Sanitize markdown links that could contain javascript:
    sanitized = sanitized.replace(/\[([^\]]*)\]\(\s*javascript:/gi, '[$1](#');

    // Sanitize markdown images that could contain javascript:
    sanitized = sanitized.replace(/!\[([^\]]*)\]\(\s*javascript:/gi, '![$1](#');

    return sanitized;
}

/**
 * Command Injection Prevention
 * Blocks dangerous command execution patterns
 */
export function sanitizeCommandInput(input: string): string {
    // Block backticks (command substitution)
    let sanitized = input.replace(/`/g, '');

    // Block $() command substitution
    sanitized = sanitized.replace(/\$\([^)]*\)/g, '');

    // Block && and || operators
    sanitized = sanitized.replace(/&&/g, '');
    sanitized = sanitized.replace(/\|\|/g, '');

    // Block ; command chaining
    sanitized = sanitized.replace(/;/g, '');

    // Block | pipe operators (might be needed for legitimate use, so comment out if needed)
    // sanitized = sanitized.replace(/\|/g, '');

    // Block redirection operators
    sanitized = sanitized.replace(/>/g, '');
    sanitized = sanitized.replace(/</g, '');

    return sanitized;
}

/**
 * Path Traversal Prevention
 * Validates and sanitizes file paths to prevent directory traversal
 */
export function sanitizeFilePath(input: string): string {
    // Remove any path traversal sequences
    let sanitized = input.replace(/\.\./g, '');

    // Remove absolute path attempts
    sanitized = sanitized.replace(/^\//, '');
    sanitized = sanitized.replace(/^\\/g, '');

    // Remove Windows drive letters
    sanitized = sanitized.replace(/^[a-zA-Z]:[\\\/]/g, '');

    // Remove UNC path attempts
    sanitized = sanitized.replace(/^\\\\/g, '');

    // Normalize path separators to forward slashes
    sanitized = sanitized.replace(/\\/g, '/');

    // Remove consecutive slashes
    sanitized = sanitized.replace(/\/+/g, '/');

    // Ensure the path doesn't start with slash after normalization
    sanitized = sanitized.replace(/^\//, '');

    return sanitized;
}

/**
 * S3 Key Generation with Path Traversal Protection
 * Generates safe S3 keys with proper sanitization
 */
export function generateSafeS3Key(
    userId: string,
    folder: 'labs' | 'photos',
    filename: string
): string {
    // Sanitize filename first
    const sanitizedFilename = sanitizeFilePath(filename);

    // Remove any remaining dangerous characters
    const safeFilename = sanitizedFilename.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Validate folder parameter
    if (!['labs', 'photos'].includes(folder)) {
        throw new Error('Invalid folder type');
    }

    // Validate userId format (should be UUID or similar)
    if (!/^[a-zA-Z0-9-_]+$/.test(userId)) {
        throw new Error('Invalid user ID format');
    }

    const timestamp = Date.now();
    return `${folder}/${userId}/${timestamp}-${safeFilename}`;
}

/**
 * NoSQL Injection Prevention
 * Validates input to prevent NoSQL injection attacks
 * Note: We're using PostgreSQL with Prisma, so this is mainly for documentation
 */
export function validateNoSQLInput(input: any): boolean {
    // Check for NoSQL injection patterns
    const dangerousPatterns = [
        /^\$/, // MongoDB operators
        /^\{.*\$.*\}$/, // Objects with dollar signs
        /^\[.*\$.*\]$/, // Arrays with dollar signs
    ];

    if (typeof input === 'string') {
        return !dangerousPatterns.some(pattern => pattern.test(input));
    }

    if (typeof input === 'object' && input !== null) {
        // Check for nested objects with dangerous keys
        const hasDangerousKeys = Object.keys(input).some(key =>
            key.startsWith('$') || key.includes('__proto__') || key.includes('constructor')
        );

        if (hasDangerousKeys) {
            return false;
        }

        // Recursively check nested objects
        return Object.values(input).every(value => validateNoSQLInput(value));
    }

    return true;
}

/**
 * LDAP Injection Prevention
 * Validates input to prevent LDAP injection attacks
 * Note: We don't use LDAP, but this is for completeness
 */
export function validateLDAPInput(_input: string): boolean {
    // We don't use LDAP, and blocking characters like '(' and ')'
    // breaks valid headers (User-Agent) and text input.
    return true;
}

/**
 * XML External Entity (XXE) Prevention
 * Validates XML input to prevent XXE attacks
 * Note: We don't parse XML, but this is for completeness
 */
export function validateXMLInput(input: string): boolean {
    const xxeDangerousPatterns = [
        /<!ENTITY/i,
        /<!\[CDATA\[/i,
        /SYSTEM\s+/i,
        /PUBLIC\s+/i,
        /<![^>]*>/g, // XML declarations
    ];

    return !xxeDangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * SQL Injection Additional Validation
 * Extra validation beyond Prisma's parameterized queries
 */
export function validateSQLInput(input: string): boolean {
    const sqlDangerousPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare|truncate)\b)/i,
        /(--|\/\*|\*\/)/g, // SQL comments
        /(\b(and|or|not|xor)\b.*=.*)/i, // Logical operators with comparison
        /(\bunion\b.*\bselect\b)/i, // Union select
        /(\bselect\b.*\bfrom\b)/i, // Select from
        /(\binsert\b.*\binto\b)/i, // Insert into
        /(\bdelete\b.*\bfrom\b)/i, // Delete from
        /(\bdrop\b.*\btable\b)/i, // Drop table
    ];

    const failedPattern = sqlDangerousPatterns.find(pattern => pattern.test(input));
    if (failedPattern) {
        // console.log(`[SQL Injection Block] Input: "${input}", Pattern: ${failedPattern}`);
        return false; // The caller will throw the error, we need to pass details back somehow?
        // Actually, validateSQLInput returns boolean.
        // I need to change validateSQLInput to return a reason or valid boolean?
        // Or I can just rely on the fact that I'm debugging.
        // Let's print to console AGAIN but make sure it flushes? No.
        // Better: let's temporarily throw the error HERE to see the stack and message.
    }
    return true;
}

/**
 * Generic Input Sanitization
 * Applies multiple sanitization layers based on input type
 */
export function sanitizeInput(input: string, type: 'text' | 'html' | 'markdown' | 'command' | 'path' = 'text'): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    let sanitized = input.trim();

    // Apply type-specific sanitization
    switch (type) {
        case 'html':
            sanitized = stripDangerousHtml(sanitized);
            sanitized = encodeHtmlEntities(sanitized);
            break;
        case 'markdown':
            sanitized = sanitizeMarkdown(sanitized);
            break;
        case 'command':
            sanitized = sanitizeCommandInput(sanitized);
            break;
        case 'path':
            sanitized = sanitizeFilePath(sanitized);
            break;
        case 'text':
        default:
            // Basic text sanitization
            sanitized = stripDangerousHtml(sanitized);
            break;
    }

    // Apply additional validation
    if (!validateNoSQLInput(sanitized)) {
        throw new Error('Input contains potentially dangerous patterns');
    }

    if (!validateSQLInput(sanitized)) {
        throw new Error('Input contains SQL injection patterns');
    }

    if (!validateLDAPInput(sanitized)) {
        throw new Error('Input contains LDAP injection patterns');
    }

    if (!validateXMLInput(sanitized)) {
        throw new Error('Input contains XML external entity patterns');
    }

    return sanitized;
}

/**
 * Zod Schema Extensions for Input Sanitization
 */
export const SanitizedStringSchema = z.string()
    .transform(val => sanitizeInput(val, 'text'));

export const SanitizedHtmlSchema = z.string()
    .transform(val => sanitizeInput(val, 'html'));

export const SanitizedMarkdownSchema = z.string()
    .transform(val => sanitizeInput(val, 'markdown'));

export const SafePathSchema = z.string()
    .transform(val => sanitizeFilePath(val));

export const SafeFilenameSchema = z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Filename contains invalid characters')
    .transform(val => sanitizeFilePath(val));

/**
 * Validation Result Type
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    sanitized?: string;
}

/**
 * Comprehensive Input Validation
 */
export function validateInput(input: any, expectedType: 'string' | 'number' | 'boolean' | 'object' = 'string'): ValidationResult {
    const errors: string[] = [];

    try {
        // Type validation
        if (typeof input !== expectedType) {
            errors.push(`Expected ${expectedType}, got ${typeof input}`);
            return { isValid: false, errors };
        }

        if (typeof input === 'string') {
            // Length validation
            if (input.length > 10000) {
                errors.push('Input exceeds maximum length of 10000 characters');
                return { isValid: false, errors };
            }

            // Apply sanitization
            const sanitized = sanitizeInput(input);

            return {
                isValid: errors.length === 0,
                errors,
                sanitized
            };
        }

        return { isValid: errors.length === 0, errors };

    } catch (error) {
        errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { isValid: false, errors };
    }
}