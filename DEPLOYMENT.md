# Deploying MediMind to Google Cloud

This project uses **Google Gemini AI** (via the official Generative Language API) and is ready to deploy to Google's hosting platforms to fulfill the "Google technology" requirement.

---

## ✅ Google Technologies Already Used

| Layer | Google Technology |
|---|---|
| AI / LLM | **Google Gemini API** (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-1.5-flash`) — direct calls to `generativelanguage.googleapis.com` |
| Voice input | **Web Speech Recognition API** (Google Chrome's speech engine) |
| Voice output | **Web Speech Synthesis API** |
| Hosting (after deploy) | **Firebase Hosting** OR **Google Cloud Run** |

---

## Option A — Firebase Hosting (Recommended, ~5 min)

Static SPA hosting on Google's edge CDN. Free tier available.

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login & create a project
```bash
firebase login
```
Then go to https://console.firebase.google.com → **Add project** → note the **Project ID**.

### 3. Set your project ID
Edit `.firebaserc` and replace `d-devs-f381d` with your actual ID.

### 4. Build and deploy
```bash
npm run build
firebase deploy --only hosting
```

Your app goes live at `https://<project-id>.web.app` 🎉

---

## Option B — Google Cloud Run (Containerized)

Serverless container hosting. Pay only for traffic.

### 1. Install gcloud CLI
https://cloud.google.com/sdk/docs/install

### 2. Authenticate & set project
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

### 3. Enable required APIs
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### 4. Deploy (one command — builds Docker image and deploys)
```bash
gcloud run deploy medimind \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

The CLI will print your public URL, e.g. `https://medimind-xxxxx.a.run.app` 🎉

---

## Notes on Backend (Edge Functions)


