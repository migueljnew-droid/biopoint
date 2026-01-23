# Deploying BioPoint

## API Deployment (Render)

### 1. Create Render Account

Sign up at [render.com](https://render.com)

### 2. Create Web Service

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: biopoint-api
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Root Directory**: Leave blank
   - **Runtime**: Node
   - **Build Command**: `cd apps/api && npm install && npm run build`
   - **Start Command**: `cd apps/api && npm start`

### 3. Environment Variables

Add these in the Render dashboard:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Random 32+ char secret |
| `JWT_ACCESS_EXPIRES` | `15m` |
| `JWT_REFRESH_EXPIRES` | `7d` |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Your AWS key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret |
| `S3_BUCKET` | `biopoint-uploads` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `*` or your app domain |

### 4. Deploy

Click "Create Web Service". Render will build and deploy automatically.

Your API will be available at: `https://biopoint-api.onrender.com`

## Database (Neon)

### 1. Create Neon Project

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

### 2. Run Migrations

From your local machine:

```bash
DATABASE_URL="your-neon-url" npm run db:migrate
```

## S3 Setup

### 1. Create S3 Bucket

1. Go to AWS S3 console
2. Create bucket: `biopoint-uploads`
3. Enable CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 2. Create IAM User

1. Create IAM user with programmatic access
2. Attach policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::biopoint-uploads/*"
    }
  ]
}
```

1. Save access key and secret

## Mobile App

For production mobile builds, use EAS Build:

```bash
npm install -g eas-cli
cd apps/mobile
eas build --platform ios
eas build --platform android
```

Update `app.json` with your production API URL before building.

## Post-Deployment Checklist

- [ ] API health check responds
- [ ] Database migrations applied
- [ ] S3 uploads working
- [ ] Auth flow works end-to-end
- [ ] SSL/TLS enabled (automatic on Render)
