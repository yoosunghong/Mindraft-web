# 민관협력 지원 플랫폼 클라우드(Naver/KT/NHN Cloud) 컨테이너 배포용
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3210 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY lib ./lib
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3210
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3210/api/health || exit 1
CMD ["node", "server.js"]
