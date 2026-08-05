"""
Trains the livestock disease CNN on your own dataset and saves a .h5 model
file that the FastAPI backend can use for real predictions instead of mock
random ones.

Usage:
    python train_model.py --data-dir data --epochs 20

Expects --data-dir laid out as one subfolder per class, e.g.:
    data/
      Healthy/
        img001.jpg
        img002.jpg
      Lumpy Skin Disease/
        img001.jpg
        ...

Subfolder names MUST exactly match the `name` column of the `diseases`
table in database/schema.sql (case-sensitive), since that's how the app
looks up which disease a prediction refers to. You don't need to pre-split
train/validation yourself - that's handled automatically.

When training finishes, it prints the path to the saved model. Point
MODEL_PATH in backend/.env at that path and restart the backend to start
using it instead of mock predictions.
"""
import argparse

from app.ml.model import LivestockDiseaseDetector


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", default="data", help="Folder containing one subfolder per class (default: data)")
    parser.add_argument("--output", default="best_model.h5", help="Where to save the trained model (default: best_model.h5)")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    detector = LivestockDiseaseDetector()
    detector.train(
        data_dir=args.data_dir,
        output_path=args.output,
        epochs=args.epochs,
        batch_size=args.batch_size,
    )

    print(f"\nDone. Model saved to {args.output}")
    print(f"Set MODEL_PATH={args.output} in backend/.env and restart the backend to use it.")


if __name__ == "__main__":
    main()
