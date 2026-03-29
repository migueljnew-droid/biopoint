#!/usr/bin/env node

/**
 * Simple test script to verify input sanitization implementation
 */

const { sanitizeInput, sanitizeFilePath, validateSQLInput, stripDangerousHtml } = require('./apps/api/src/utils/sanitization.ts');

console.log('🧪 Testing BioPoint Input Sanitization...\n');

// Test XSS Prevention
console.log('🛡️  XSS Prevention Tests:');
const xssTests = [
    { input: '<script>alert("XSS")</script>', expected: 'alert(\"XSS\")' },
    { input: 'javascript:alert("XSS")', expected: 'alert(\"XSS\")' },
    { input: '<img src=x onerror=alert("XSS")>', expected: '' },
    { input: 'Hello <b>World</b>', expected: 'Hello <b>World</b>' }
];

xssTests.forEach((test, index) => {
    const result = stripDangerousHtml(test.input);
    const passed = result === test.expected;
    console.log(`  Test ${index + 1}: ${passed ? '✅' : '❌'} "${test.input}" → "${result}"`);
    if (!passed) {
        console.log(`    Expected: "${test.expected}"`);
    }
});

// Test Path Traversal Prevention
console.log('\n📁 Path Traversal Prevention Tests:');
const pathTests = [
    { input: '../../../etc/passwd', expected: 'etc/passwd' },
    { input: '/etc/passwd', expected: 'etc/passwd' },
    { input: 'C:\\Windows\\System32\\config\\sam', expected: 'WindowsSystem32configsam' },
    { input: 'normal-file.jpg', expected: 'normal-file.jpg' }
];

pathTests.forEach((test, index) => {
    const result = sanitizeFilePath(test.input);
    const passed = result === test.expected;
    console.log(`  Test ${index + 1}: ${passed ? '✅' : '❌'} "${test.input}" → "${result}"`);
    if (!passed) {
        console.log(`    Expected: "${test.expected}"`);
    }
});

// Test SQL Injection Prevention
console.log('\n🗄️  SQL Injection Prevention Tests:');
const sqlTests = [
    { input: "' OR '1'='1", expected: false },
    { input: "'; DROP TABLE users;--", expected: false },
    { input: "UNION SELECT * FROM users", expected: false },
    { input: "normal@example.com", expected: true }
];

sqlTests.forEach((test, index) => {
    const result = validateSQLInput(test.input);
    const passed = result === test.expected;
    console.log(`  Test ${index + 1}: ${passed ? '✅' : '❌'} "${test.input}" → ${result}`);
    if (!passed) {
        console.log(`    Expected: ${test.expected}`);
    }
});

// Test General Input Sanitization
console.log('\n🔧 General Input Sanitization Tests:');
const generalTests = [
    { input: 'Hello World', type: 'text', contains: 'Hello World' },
    { input: '<script>alert("XSS")</script>Test', type: 'text', notContains: '<script>' },
    { input: 'test`whoami`', type: 'command', notContains: '`' },
    { input: 'test$(rm -rf /)', type: 'command', notContains: '$(' }
];

generalTests.forEach((test, index) => {
    try {
        const result = sanitizeInput(test.input, test.type);
        let passed = true;
        
        if (test.contains && !result.includes(test.contains)) {
            passed = false;
        }
        if (test.notContains && result.includes(test.notContains)) {
            passed = false;
        }
        
        console.log(`  Test ${index + 1}: ${passed ? '✅' : '❌'} "${test.input}" (${test.type}) → "${result}"`);
    } catch (error) {
        console.log(`  Test ${index + 1}: ❌ "${test.input}" (${test.type}) → ERROR: ${error.message}`);
    }
});

console.log('\n✨ All tests completed!');