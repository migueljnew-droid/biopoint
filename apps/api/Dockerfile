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
COPY .npmrc ./
RUN npm install --force

# Copy source
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY db ./db

# Generate Prisma client (bypass doppler wrapper)
RUN cd db && npx prisma generate

# Build
RUN npm run build:shared || true
RUN cd packages/shared && npx tsc || true
RUN cd apps/api && npx tsc

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/db ./db

RUN npm install -g tsx

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--import", "tsx", "apps/api/dist/index.js"]
