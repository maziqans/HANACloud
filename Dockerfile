FROM node:20-alpine

WORKDIR /app

# Copy package manifests first to leverage Docker layer caching
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN rm -f package-lock.json && npm install

# Copy the rest of your application code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]