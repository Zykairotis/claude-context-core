FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (tree-sitter, faiss-node) and git for repository cloning
RUN apk add --no-cache python3 make g++ git curl

# Copy package files
COPY services/api-server/package*.json ./
COPY services/api-server/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY services/api-server/src ./src

# Copy core dist artifacts and create symlink for module resolution
COPY dist /dist
RUN ln -s /app/node_modules /dist/node_modules

# Build TypeScript
RUN npm run build

# Expose API port
EXPOSE 3030

# Start server
CMD ["npm", "start"]
