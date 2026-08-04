import os
import shutil
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException

from app.auth.supabase_auth import get_current_user
from app.ml.model import LivestockDiseaseDetector

router = APIRouter()

MODEL_PATH = os.getenv("MODEL_PATH", "")  # e.g. "models/best_model.h5"
detector = LivestockDiseaseDetector(model_path=MODEL_PATH or None)

UPLOAD_DIR = "uploads/"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg"}
MAX_FILE_SIZE_MB = 8


@router.post("/predict")
async def predict_disease(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    Runs the CNN on an uploaded livestock image.
    Requires a valid Supabase session token (Authorization: Bearer <token>).
    Does NOT write to the database - the mobile app inserts the resulting
    row into Supabase's `predictions` table itself, since it already holds
    the authenticated Supabase session.
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="File must be a JPEG or PNG image")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"Image exceeds {MAX_FILE_SIZE_MB}MB limit")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S%f")
    safe_filename = f"{current_user['id']}_{timestamp}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, safe_filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    try:
        result = detector.predict(filepath)
        result["recommendation"] = get_recommendation(result)
        return {"status": "success", "prediction": result, "timestamp": timestamp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
    finally:
        # Temp file only needed for inference; the real copy lives in
        # Supabase Storage once the app uploads it there.
        if os.path.exists(filepath):
            os.remove(filepath)


def get_recommendation(prediction: dict) -> str:
    if prediction.get("is_animal") is False:
        return "This doesn't look like a livestock photo. Please retake a clear, well-lit photo of the animal."
    if prediction.get("uncertain") or prediction["confidence"] < 0.7:
        return "Low confidence / uncertain result. Please consult a veterinarian for an accurate diagnosis."
    if prediction["disease"] == "Healthy":
        return "Animal appears healthy. Continue regular monitoring."
    return f"Possible {prediction['disease']}. Please consult a veterinarian immediately."
