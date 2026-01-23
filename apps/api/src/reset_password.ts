
import { prisma } from '@biopoint/db';
import { hashPassword } from './utils/auth.js';

async function main() {
    const passwordHash = await hashPassword('Admin123!');
    const user = await prisma.user.update({
        where: { email: 'admin@biopoint.app' },
        data: { passwordHash },
    });
    console.log('Password updated for user:', user.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
