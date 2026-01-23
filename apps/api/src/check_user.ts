
import { prisma } from '@biopoint/db';

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@biopoint.app' },
    });
    console.log('User found:', user);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
