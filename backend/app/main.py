from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.routes import model_routes

app = FastAPI(
    title="Livestock Disease Detection - Inference API",
    description=(
        "Runs the CNN model for livestock disease detection. "
        "Authentication, user data, and storage are handled by Supabase; "
        "this service ONLY performs image inference."
    ),
    version="1.0.0",
)

# CORS - restrict this to your app's actual origin in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(model_routes.router, prefix="/api", tags=["Disease Detection"])


@app.get("/")
async def root():
    return {
        "message": "Livestock Disease Detection Inference API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
