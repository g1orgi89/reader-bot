# MongoDB Setup Guide for Windows

## Quick Diagnosis

Run this command to diagnose your MongoDB setup:

```bash
node diagnose-mongodb.js
```

## Option 1: MongoDB Community Server (Recommended)

### Download and Install

1. Go to [MongoDB Download Center](https://www.mongodb.com/try/download/community)
2. Select:
   - Version: Latest stable (7.0 or higher)
   - Platform: Windows x64
   - Package: MSI

3. Download and run the installer
4. During installation:
   - Choose "Complete" installation
   - Check "Install MongoDB as a Service" ✅
   - Check "Install MongoDB Compass" (GUI tool) ✅

### Start MongoDB Service

```bash
# Start MongoDB service
net start MongoDB

# Check if running
sc query MongoDB
```

### Verify Installation

```bash
# Test connection
mongosh

# Or test with our script
node test-mongodb-simple.js
```

## Option 2: MongoDB with Docker (Alternative)

If you have Docker installed:

```bash
# Pull and run MongoDB
docker run -d --name mongodb -p 27017:27017 mongo:latest

# Check if running
docker ps

# Test connection
node test-mongodb-simple.js
```

## Option 3: MongoDB Atlas (Cloud - No Local Install)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create free account
3. Create a free cluster
4. Get connection string
5. Update `.env` file:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/shrooms-support
```

## Troubleshooting

### MongoDB Service Not Starting

```bash
# Check Windows services
services.msc

# Look for "MongoDB" service
# Right-click -> Start
```

### Port 27017 Already in Use

```bash
# Find what's using the port
netstat -ano | findstr :27017

# Kill the process (replace PID)
taskkill /PID <process_id> /F
```

### Access Denied Errors

- Run Command Prompt as Administrator
- Make sure MongoDB service has proper permissions

## Test Your Setup

After installation, run:

```bash
# Diagnose MongoDB setup
node diagnose-mongodb.js

# Test connection
node test-mongodb-simple.js

# Start the bot
npm run dev
```

## Environment Variables

Make sure your `.env` file has:

```env
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/shrooms-support

# For MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/shrooms-support

# Other required variables
ANTHROPIC_API_KEY=your-api-key-here
NODE_ENV=development
```

## Need Help?

If you're still having issues:

1. Check the [MongoDB Windows Installation Guide](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/)
2. Join our Discord for support
3. Create an issue on GitHub

---

**Quick commands reference:**

```bash
# Start MongoDB (Windows)
net start MongoDB

# Connect to MongoDB
mongosh

# Restart MongoDB service
net stop MongoDB && net start MongoDB

# Check MongoDB status
sc query MongoDB
```