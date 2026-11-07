FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* — build vaqtida JS'ga yoziladi (docker-compose.prod.yml → build.args). Secret emas, ochiq qiymatlar.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_CONTACT_PHONE
ARG NEXT_PUBLIC_CONTACT_TELEGRAM
ARG NEXT_PUBLIC_CONTACT_ADDRESS
ARG NEXT_PUBLIC_APP_STORE_URL
ARG NEXT_PUBLIC_GOOGLE_PLAY_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_PUBLIC_CONTACT_PHONE=$NEXT_PUBLIC_CONTACT_PHONE \
    NEXT_PUBLIC_CONTACT_TELEGRAM=$NEXT_PUBLIC_CONTACT_TELEGRAM \
    NEXT_PUBLIC_CONTACT_ADDRESS=$NEXT_PUBLIC_CONTACT_ADDRESS \
    NEXT_PUBLIC_APP_STORE_URL=$NEXT_PUBLIC_APP_STORE_URL \
    NEXT_PUBLIC_GOOGLE_PLAY_URL=$NEXT_PUBLIC_GOOGLE_PLAY_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Runtime config (poweredByHeader va h.k.) — `next start` uni ishga tushganda o'qiydi; bo'lmasa standart sozlamalar
COPY --from=builder /app/next.config.ts ./next.config.ts
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node_modules/.bin/next", "start"]
