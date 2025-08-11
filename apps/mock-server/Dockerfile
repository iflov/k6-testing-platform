# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
# Install dependencies
RUN npm install

# Copy all configuration files needed for NestJS build
COPY nest-cli.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Use production start script
CMD ["npm", "run", "start:prod"]