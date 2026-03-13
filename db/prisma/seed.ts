import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface PeptideJson {
    id: string;
    name: string;
    aliases: string[];
    category: string;
    goals: string[];
    typicalDose: {
        min: number;
        max: number;
        unit: string;
    };
    halfLife: string;
    route: string;
    frequency: string;
    cycleProtocol: string;
    stackingNotes: string;
    citations: unknown[];
    iuConversion: number | null;
    description: string;
}

async function seedPeptideCompounds() {
    const jsonPath = path.resolve(
        __dirname,
        '../../apps/mobile/src/data/peptideDatabase.json'
    );
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const compounds: PeptideJson[] = JSON.parse(raw);

    for (const compound of compounds) {
        await prisma.peptideCompound.upsert({
            where: { name: compound.name },
            update: {},
            create: {
                name: compound.name,
                aliases: compound.aliases,
                category: compound.category,
                goals: compound.goals,
                typicalDoseMin: compound.typicalDose.min,
                typicalDoseMax: compound.typicalDose.max,
                typicalDoseUnit: compound.typicalDose.unit,
                halfLife: compound.halfLife,
                route: compound.route,
                frequency: compound.frequency,
                cycleProtocol: compound.cycleProtocol,
                stackingNotes: compound.stackingNotes,
                citations: compound.citations,
                iuConversion: compound.iuConversion ?? undefined,
                description: compound.description,
            },
        });
    }

    console.log(`Seeded ${compounds.length} peptide compounds`);
}

async function main() {
    console.log('Seeding database...');

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
    console.log(`Created admin user: ${admin.email}`);

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
    console.log(`Created test user: ${testUser.email}`);

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
    console.log(`Created sample stack: ${stack.name}`);

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
    console.log('Created sample daily logs');

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
    console.log('Created sample BioPoint scores');

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
    console.log(`Created sample group: ${group.name}`);

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
    console.log('Created sample stack template');

    // Create system fasting protocols
    const protocols = [
        { name: '16:8 Intermittent', slug: '16-8', fastingHours: 16, eatingHours: 8, description: 'The most popular IF protocol. Skip breakfast, eat lunch to dinner.', icon: 'time-outline' },
        { name: '18:6 Intermittent', slug: '18-6', fastingHours: 18, eatingHours: 6, description: 'Extended IF window. Eat within a 6-hour window.', icon: 'time-outline' },
        { name: '20:4 Warrior', slug: '20-4', fastingHours: 20, eatingHours: 4, description: 'Warrior Diet style. One large meal and snacks in 4 hours.', icon: 'shield-outline' },
        { name: 'OMAD (23:1)', slug: 'omad', fastingHours: 23, eatingHours: 1, description: 'One Meal A Day. Maximum autophagy benefits.', icon: 'restaurant-outline' },
        { name: '36-Hour Fast', slug: '36h', fastingHours: 36, eatingHours: 0, description: 'Extended fast crossing two sleep cycles. Deep autophagy.', icon: 'moon-outline' },
        { name: '5:2 Diet', slug: '5-2', fastingHours: 24, eatingHours: 0, description: 'Eat normally 5 days, fast (or 500cal) 2 days per week.', icon: 'calendar-outline' },
        { name: 'Alternate Day', slug: 'alternate-day', fastingHours: 36, eatingHours: 12, description: 'Fast every other day. Powerful for fat loss.', icon: 'swap-horizontal-outline' },
        { name: 'Eat-Stop-Eat', slug: 'eat-stop-eat', fastingHours: 24, eatingHours: 0, description: '24-hour fast once or twice per week.', icon: 'close-circle-outline' },
        { name: 'Warrior Diet', slug: 'warrior', fastingHours: 20, eatingHours: 4, description: 'Small raw fruits/veggies during day, feast at night.', icon: 'fitness-outline' },
        { name: 'Circadian Rhythm', slug: 'circadian', fastingHours: 13, eatingHours: 11, description: 'Eat with the sun. Stop eating by sunset.', icon: 'sunny-outline' },
        { name: 'Water Fast 24h', slug: 'water-24', fastingHours: 24, eatingHours: 0, description: '24-hour water-only fast. Great for weekly reset.', icon: 'water-outline' },
        { name: 'Water Fast 48h', slug: 'water-48', fastingHours: 48, eatingHours: 0, description: '48-hour water-only fast. Deep autophagy and HGH surge.', icon: 'water-outline' },
    ];

    for (const p of protocols) {
        await prisma.fastingProtocol.upsert({
            where: { slug: p.slug },
            update: {},
            create: { ...p, isSystem: true },
        });
    }
    console.log(`Created ${protocols.length} system fasting protocols`);

    // Seed peptide compounds from JSON database
    await seedPeptideCompounds();

    console.log('Seeding complete!');
}

main()
    .catch((e) => {
        console.error('Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
