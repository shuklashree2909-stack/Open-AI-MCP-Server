# --- Build Stage ---
    FROM node:18-alpine AS builder

    WORKDIR /app
    
    COPY package.json package-lock.json ./
    RUN npm install
    
    COPY . .
    RUN npm run build
    
    # --- Production Stage ---
    FROM node:18-alpine
    
    WORKDIR /app
    
    COPY --from=builder /app/package.json /app/package-lock.json ./
    RUN npm install --only=production
    
    COPY --from=builder /app/dist ./dist
    
    
    EXPOSE 4000
    
    CMD ["node", "dist/server.js"]
    