FROM node:20-alpine

WORKDIR /app

# Set default dev mode (can be overridden at runtime)
ENV VITE_DEV_MODE=false

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Run development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
