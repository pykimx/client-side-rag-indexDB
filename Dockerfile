#
# file name: Dockerfile
# file description: Docker build instructions for the client-side RAG app, including multi-stage build for dependencies and production image.
# author: Google Gemini, AI Assistant
# date created: 2024-06-07
# version number: 1.0
# AI WARNING: This file is generated with AI assistance. Please review and verify the content before use.
#

# ---- Base Node ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm ci

# ---- Builder ----
FROM dependencies AS builder
COPY . .
# You can pass build-time environment variables for Vite here if needed
# ARG VITE_API_KEY
# ENV VITE_API_KEY=$VITE_API_KEY
# ARG VITE_OPENAI_API_KEY
# ENV VITE_OPENAI_API_KEY=$VITE_OPENAI_API_KEY
# ARG VITE_OLLAMA_BASE_URL
# ENV VITE_OLLAMA_BASE_URL=$VITE_OLLAMA_BASE_URL
# ARG VITE_OLLAMA_MODEL_NAME
# ENV VITE_OLLAMA_MODEL_NAME=$VITE_OLLAMA_MODEL_NAME

RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

# Install 'serve' to serve static files
RUN npm install -g serve

# Copy built assets from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 8080

# Serve the app
CMD ["serve", "-s", "dist", "-l", "8080"]

# END