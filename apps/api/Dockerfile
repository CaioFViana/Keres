# Use an official Bun runtime as a parent image
FROM oven/bun:latest

# Set the working directory in the container
WORKDIR /app

# Install dependencies
# Copy package.json first to leverage Docker cache
COPY package.json ./
RUN bun install

# Copy the rest of the application code
COPY . .

# Build the application (if applicable, for Elysia it might be just `bun run index.ts`)
# For a simple Elysia app, a build step might not be strictly necessary if it's just running TS directly.
# However, for production, you might want to transpile to JS.
# For now, we'll assume direct execution.

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["bun", "run", "src/index.ts"]
