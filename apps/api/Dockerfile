FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY db/package*.json ./db/

# Install dependencies
RUN npm install

# Copy source
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY db ./db

# Generate Prisma client
RUN npm run db:generate

# Build
RUN npm run build:shared
RUN npm run build:api

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/db/node_modules/.prisma ./db/node_modules/.prisma
COPY --from=builder /app/db/package.json ./db/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
