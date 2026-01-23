import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const adminPassword = await hash('Admin123!', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@biopoint.app' },
        update: {},
        create: {
            email: 'admin@biopoint.app',
            passwordHash: adminPassword,
            role: 'ADMIN',
            profile: {
                create: {
                    sex: 'male',
                    heightCm: 180,
                    baselineWeightKg: 80,
                    goals: ['optimize_health', 'build_muscle'],
                    dietStyle: 'high_protein',
                    consentNotMedical: true,
                    consentDataStorage: true,
                    consentResearch: false,
                    onboardingComplete: true,
                },
            },
        },
    });
    console.log(`✅ Created admin user: ${admin.email}`);

    // Create test user
    const testPassword = await hash('Test1234!', 12);
    const testUser = await prisma.user.upsert({
        where: { email: 'test@biopoint.app' },
        update: {},
        create: {
            email: 'test@biopoint.app',
            passwordHash: testPassword,
            role: 'USER',
            profile: {
                create: {
                    sex: 'male',
                    dateOfBirth: new Date('1990-01-15'),
                    heightCm: 175,
                    baselineWeightKg: 75,
                    goals: ['lose_fat', 'improve_sleep'],
                    dietStyle: 'balanced',
                    consentNotMedical: true,
                    consentDataStorage: true,
                    consentResearch: true,
                    consentResearchAt: new Date(),
                    onboardingComplete: true,
                },
            },
        },
    });
    console.log(`✅ Created test user: ${testUser.email}`);

    // Create a sample stack for test user
    const stack = await prisma.stack.create({
        data: {
            userId: testUser.id,
            name: 'Morning Optimization Stack',
            goal: 'Improve energy and focus',
            items: {
                create: [
                    {
                        name: 'Vitamin D3',
                        dose: 5000,
                        unit: 'IU',
                        route: 'Oral',
                        frequency: 'Daily',
                        timing: 'Morning with food',
                        isActive: true,
                    },
                    {
                        name: 'Omega-3 Fish Oil',
                        dose: 2000,
                        unit: 'mg',
                        route: 'Oral',
                        frequency: 'Daily',
                        timing: 'With breakfast',
                        isActive: true,
                    },
                    {
                        name: 'Magnesium Glycinate',
                        dose: 400,
                        unit: 'mg',
                        route: 'Oral',
                        frequency: 'Daily',
                        timing: 'Before bed',
                        isActive: true,
                    },
                ],
            },
        },
    });
    console.log(`✅ Created sample stack: ${stack.name}`);

    // Create sample daily logs
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await prisma.dailyLog.upsert({
            where: {
                userId_date: {
                    userId: testUser.id,
                    date: new Date(date.toISOString().split('T')[0]!),
                },
            },
            update: {},
            create: {
                userId: testUser.id,
                date: new Date(date.toISOString().split('T')[0]!),
                weightKg: 75 - i * 0.1,
                sleepHours: 7 + Math.random(),
                sleepQuality: Math.floor(6 + Math.random() * 4),
                energyLevel: Math.floor(5 + Math.random() * 5),
                focusLevel: Math.floor(5 + Math.random() * 5),
                moodLevel: Math.floor(6 + Math.random() * 4),
            },
        });
    }
    console.log('✅ Created sample daily logs');

    // Create sample BioPoint scores
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        const breakdown = {
            sleep: 15 + Math.floor(Math.random() * 10),
            energy: 15 + Math.floor(Math.random() * 10),
            focus: 15 + Math.floor(Math.random() * 10),
            mood: 15 + Math.floor(Math.random() * 10),
            weight: 15 + Math.floor(Math.random() * 10),
        };

        await prisma.bioPointScore.upsert({
            where: {
                userId_date: {
                    userId: testUser.id,
                    date: new Date(date.toISOString().split('T')[0]!),
                },
            },
            update: {},
            create: {
                userId: testUser.id,
                date: new Date(date.toISOString().split('T')[0]!),
                score: Object.values(breakdown).reduce((a, b) => a + b, 0),
                breakdown,
            },
        });
    }
    console.log('✅ Created sample BioPoint scores');

    // Create a sample group
    const group = await prisma.group.create({
        data: {
            name: 'Optimization Protocols',
            description: 'Share and discuss health optimization stacks',
            createdById: admin.id,
            isPublic: true,
            members: {
                create: [
                    { userId: admin.id, role: 'admin' },
                    { userId: testUser.id, role: 'member' },
                ],
            },
        },
    });
    console.log(`✅ Created sample group: ${group.name}`);

    // Create a sample template
    await prisma.stackTemplate.create({
        data: {
            groupId: group.id,
            name: 'Beginner Wellness Stack',
            description: 'A simple starter stack for overall wellness',
            goal: 'General health improvement',
            itemsJson: [
                { name: 'Vitamin D3', dose: 5000, unit: 'IU', route: 'Oral', frequency: 'Daily', timing: 'Morning' },
                { name: 'Omega-3', dose: 2000, unit: 'mg', route: 'Oral', frequency: 'Daily', timing: 'With food' },
                { name: 'Magnesium', dose: 400, unit: 'mg', route: 'Oral', frequency: 'Daily', timing: 'Evening' },
            ],
        },
    });
    console.log('✅ Created sample stack template');

    console.log('✨ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
