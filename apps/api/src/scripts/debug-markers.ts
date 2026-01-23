import { PrismaClient } from '@biopoint/db';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching users...');
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users.`);

    for (const user of users) {
        console.log(`\nUser: ${user.email} (${user.id})`);

        const reports = await prisma.labReport.findMany({
            where: { userId: user.id },
            include: { markers: true }
        });

        console.log(`- Reports: ${reports.length}`);

        for (const report of reports) {
            console.log(`  Report: ${report.filename} (ID: ${report.id})`);
            console.log(`  Markers: ${report.markers.length}`);
            report.markers.forEach(m => {
                console.log(`    - ${m.name}: ${m.value} ${m.unit} (Recorded: ${m.recordedAt})`);
            });
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
