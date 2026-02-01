# Use Node.js Alpine (Lightweight)
FROM node:24-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Copy the rest of the app
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the Next.js app
RUN npm run build

# Expose Port 3000
EXPOSE 3000

# Start the app
CMD ["npm", "start"]