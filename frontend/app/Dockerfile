FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.base.json vitest.config.ts vite.config.ts ./
COPY frontend ./frontend

CMD ["npx", "vite", "--config", "vite.config.ts", "--host", "0.0.0.0", "--port", "5173"]