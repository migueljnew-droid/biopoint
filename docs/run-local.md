# Running BioPoint Locally

## Prerequisites

- Node.js 20+
- npm 9+
- PostgreSQL database (or use Neon free tier)
- AWS account (for S3) or mock storage

## Setup Steps

### 1. Clone and Install

```bash
cd biopoint
npm install
```

### 2. Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Random 32+ character string
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`: For file uploads

### 3. Database Setup

Generate Prisma client:

```bash
npm run db:generate
```

Run migrations:

```bash
npm run db:migrate
```

Seed with test data (optional):

```bash
npm run db:seed
```

### 4. Start the API

```bash
npm run dev:api
```

The API will start at `http://localhost:3000`.

Verify with:

```bash
curl http://localhost:3000/health
```

### 5. Start the Mobile App

In a new terminal:

```bash
npm run dev:mobile
```

This starts Expo. Press:

- `i` for iOS simulator
- `a` for Android emulator
- Scan QR code with Expo Go app for physical device

### 6. Test Credentials

After seeding, you can login with:

- **Admin**: <admin@biopoint.app> / Admin123!
- **User**: <test@biopoint.app> / Test1234!

## Common Issues

### Prisma client not found

Run `npm run db:generate` to regenerate the Prisma client.

### Port already in use

Kill the process using port 3000:

```bash
lsof -ti:3000 | xargs kill -9
```

### Mobile app can't connect to API

- Ensure API is running
- For physical device, update `EXPO_PUBLIC_API_URL` to your machine's IP
- Check firewall settings
