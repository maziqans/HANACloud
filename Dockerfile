FROM node:20-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN rm -f package-lock.json && npm install

# Copy the rest of your application code and build
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]