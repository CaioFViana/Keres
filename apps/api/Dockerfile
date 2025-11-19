# Use an official Bun runtime as a parent image
FROM oven/bun:latest

# Set the working directory in the container to the monorepo root
WORKDIR /app

# Copy root package.json and bun.lock to resolve monorepo dependencies
COPY package.json bun.lock ./

# Copy the entire packages directory from the monorepo root
COPY packages packages

# Copy the api app's package.json and tsconfig.json
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

# Install dependencies - bun install will resolve local package paths from packages/
RUN bun install

# Copy the rest of the application code for the API
COPY apps/api/src ./apps/api/src

# Set the final working directory to the API application
WORKDIR /app/apps/api

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["bun", "run", "src/index.ts"]
