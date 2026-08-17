---
title: Livestock Disease Detection API
emoji: 🐄
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Livestock Disease Detection - Inference API

FastAPI service that runs the CNN model for the Livestock Disease Detection
mobile app. Given a livestock photo and a valid Supabase auth token, it
returns a disease prediction with a confidence score.

- `GET /health` - health check
- `POST /api/predict` - upload an image (`multipart/form-data`, field name
  `file`) with `Authorization: Bearer <supabase-access-token>` to get a
  prediction
- `GET /docs` - interactive API docs (Swagger UI)

Configure via this Space's **Settings -> Variables and secrets**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/publishable key |
| `MODEL_PATH` | `best_model.h5` (leave unset to run in mock-prediction mode) |
