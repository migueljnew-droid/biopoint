import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['node_modules', 'dist', 'coverage'],
        setupFiles: ['src/__tests__/setupEnv.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.d.ts',
                'src/index.ts',
                'src/scripts/**',
                'node_modules/**',
                'dist/**',
                'coverage/**'
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80
            }
        },
        testTimeout: 120000,
        hookTimeout: 120000,
        teardownTimeout: 120000,
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true
            }
        }
    },
});
