# Deploying Next.js Frontend to Vercel

This repository contains both the python backend and Next.js frontend codebases. When deploying the frontend, follow these step-by-step configurations in Vercel:

## 1. Import Repository
- Connect your GitHub/GitLab account to Vercel.
- Select this repository and click **Import**.

## 2. Configure Project Settings
In the Project Settings page, configure the following inputs:

- **Framework Preset**: Select **Next.js** (this is usually auto-detected).
- **Root Directory**: Click *Edit* and select **`frontend`** (since the frontend code is in the subdirectory).
- **Build & Development Settings**: Keep the default values.
  - Build Command: `next build`
  - Output Directory: `.next`
  - Install Command: `npm install`

## 3. Configure Environment Variables
Expand the **Environment Variables** panel and add the following variable:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Your live backend FastAPI base URL. |

> [!IMPORTANT]
> Do NOT use `localhost` or `127.0.0.1` for the production URL. Ensure the backend FastAPI is deployed publicly and CORS is enabled.

## 4. Deploy!
- Click **Deploy**. Vercel will trigger the install, build, and publish the static edge endpoints.
