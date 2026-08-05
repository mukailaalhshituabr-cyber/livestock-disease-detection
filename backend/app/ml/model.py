import json
import os
import random
import numpy as np


class LivestockDiseaseDetector:
    """
    CNN-based disease classifier using transfer learning on MobileNetV2.
    NOTE: class names MUST stay in sync with the `diseases` table in
    Supabase (database/schema.sql) so predictions map back correctly.
    """

    # Only used when no trained model is loaded (mock mode).
    CLASS_NAMES = [
        "Healthy",
        "Lumpy Skin Disease",
        "Foot and Mouth Disease",
        "Mastitis",
    ]

    # Shared across instances - the ImageNet-pretrained full classifier used
    # only to sanity-check "is this even an animal photo" (see _check_is_animal).
    # Lazy-loaded so mock-mode/no-model setups don't pay for it.
    _animal_gate_model = None

    # ImageNet's 1000 classes are laid out in WordNet order, so all animal
    # categories (fish, birds, reptiles, insects, mammals) occupy indices
    # 0-397 and object/scene/food classes start at 398 ("abaya"). This is an
    # approximation (a handful of borderline classes exist near the boundary)
    # but is a well-known, zero-extra-data way to reject non-animal photos
    # without needing a labeled "not an animal" dataset.
    ANIMAL_CLASS_CUTOFF = 398
    ANIMAL_GATE_THRESHOLD = 0.35

    def __init__(self, model_path: str = None):
        self.img_size = (224, 224)
        self.model = None
        self.model_path = model_path

        if model_path and os.path.exists(model_path):
            self._load_model(model_path)

    def _classes_path(self, model_path):
        base, _ = os.path.splitext(model_path)
        return f"{base}.classes.json"

    def _load_model(self, model_path):
        from tensorflow import keras
        self.model = keras.models.load_model(model_path)

        # A model trained on fewer/different classes than the hardcoded
        # default (e.g. just Healthy/Lumpy Skin Disease) saves its actual
        # class order next to the .h5 file at train time - load that if
        # present so predictions map back to the right disease names.
        classes_path = self._classes_path(model_path)
        if os.path.exists(classes_path):
            with open(classes_path) as f:
                self.CLASS_NAMES = json.load(f)

    def build_model(self, num_classes: int):
        """Build a MobileNetV2 transfer-learning model. Use train_model.py
        (or call build_model()+train() directly) to train, which also saves
        the class name order alongside the .h5 file. Then point
        MODEL_PATH in backend/.env at the saved .h5 file."""
        from tensorflow import keras
        from tensorflow.keras import layers
        from tensorflow.keras.applications import MobileNetV2

        base_model = MobileNetV2(
            input_shape=(224, 224, 3), include_top=False, weights="imagenet"
        )
        base_model.trainable = False

        inputs = keras.Input(shape=(224, 224, 3))
        x = base_model(inputs, training=False)
        x = layers.GlobalAveragePooling2D()(x)
        x = layers.Dense(128, activation="relu")(x)
        x = layers.Dropout(0.3)(x)
        outputs = layers.Dense(num_classes, activation="softmax")(x)

        self.model = keras.Model(inputs, outputs)
        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss="categorical_crossentropy",
            metrics=["accuracy"],
        )
        return self.model

    def train(self, data_dir, output_path="best_model.h5", epochs=25, batch_size=32, validation_split=0.2):
        """
        Trains on a single directory laid out as one subfolder per class:
            data_dir/
              Healthy/*.jpg
              Lumpy Skin Disease/*.jpg
        Subfolder names MUST exactly match the `name` column in the
        `diseases` table (database/schema.sql), since that's how the app
        looks up which disease a prediction refers to.

        Splits train/validation automatically (no need to pre-split the
        dataset yourself), builds the model with the right number of
        classes, trains, and saves both the .h5 model and a sidecar
        <output_path>.classes.json recording the class order so predict()
        maps indices back to the correct disease names.
        """
        from tensorflow import keras
        from tensorflow.keras.preprocessing.image import ImageDataGenerator

        datagen = ImageDataGenerator(
            rescale=1.0 / 255,
            rotation_range=20,
            width_shift_range=0.2,
            height_shift_range=0.2,
            shear_range=0.2,
            zoom_range=0.2,
            horizontal_flip=True,
            fill_mode="nearest",
            validation_split=validation_split,
        )

        train_gen = datagen.flow_from_directory(
            data_dir, target_size=self.img_size, batch_size=batch_size,
            class_mode="categorical", subset="training",
        )
        val_gen = datagen.flow_from_directory(
            data_dir, target_size=self.img_size, batch_size=batch_size,
            class_mode="categorical", subset="validation",
        )

        # class_indices is {class_name: index}; invert + sort by index so
        # CLASS_NAMES[i] matches the model's output neuron i.
        class_names = [name for name, _ in sorted(train_gen.class_indices.items(), key=lambda kv: kv[1])]
        print(f"Training on {len(class_names)} classes: {class_names}")

        self.build_model(num_classes=len(class_names))

        callbacks = [
            keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
            keras.callbacks.ModelCheckpoint(output_path, monitor="val_accuracy", save_best_only=True),
        ]

        history = self.model.fit(train_gen, validation_data=val_gen, epochs=epochs, callbacks=callbacks)

        with open(self._classes_path(output_path), "w") as f:
            json.dump(class_names, f, indent=2)
        self.CLASS_NAMES = class_names

        return history

    def _get_animal_gate_model(self):
        if LivestockDiseaseDetector._animal_gate_model is None:
            from tensorflow.keras.applications import MobileNetV2
            LivestockDiseaseDetector._animal_gate_model = MobileNetV2(weights="imagenet")
        return LivestockDiseaseDetector._animal_gate_model

    def _check_is_animal(self, image_path: str) -> tuple:
        """Returns (is_animal, animal_score). See ANIMAL_CLASS_CUTOFF for the
        approximation this relies on."""
        from tensorflow import keras
        from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

        gate_model = self._get_animal_gate_model()
        img = keras.preprocessing.image.load_img(image_path, target_size=(224, 224))
        img_array = keras.preprocessing.image.img_to_array(img)
        img_array = preprocess_input(np.expand_dims(img_array, axis=0))

        predictions = gate_model.predict(img_array, verbose=0)[0]
        animal_score = float(np.sum(predictions[: self.ANIMAL_CLASS_CUTOFF]))
        return animal_score >= self.ANIMAL_GATE_THRESHOLD, animal_score

    def predict(self, image_path: str) -> dict:
        is_animal, animal_score = self._check_is_animal(image_path)
        if not is_animal:
            return {
                "disease": None,
                "confidence": 0.0,
                "all_probabilities": {},
                "is_animal": False,
                "animal_score": animal_score,
            }

        result = self._mock_predict() if self.model is None else self._predict_disease(image_path)
        result["is_animal"] = True
        result["animal_score"] = animal_score
        return result

    def _predict_disease(self, image_path: str) -> dict:
        from tensorflow import keras

        img = keras.preprocessing.image.load_img(image_path, target_size=self.img_size)
        img_array = keras.preprocessing.image.img_to_array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        predictions = self.model.predict(img_array)[0]
        ranked = np.argsort(predictions)[::-1]
        top_idx = int(ranked[0])
        top_conf = float(predictions[top_idx])
        # Margin between the top two guesses: a model that's genuinely sure
        # ("Healthy" 95%, everything else near 0%) has a wide margin; one
        # that's basically guessing between two classes ("Healthy" 52%,
        # "Lumpy Skin Disease" 48%) does not, even though top_conf alone
        # looks passable. Flag the latter as uncertain rather than asserting it.
        runner_up_conf = float(predictions[int(ranked[1])]) if len(ranked) > 1 else 0.0
        margin = top_conf - runner_up_conf

        return {
            "disease": self.CLASS_NAMES[top_idx],
            "confidence": top_conf,
            "margin": margin,
            "uncertain": top_conf < 0.6 or margin < 0.15,
            "all_probabilities": {
                name: float(p) for name, p in zip(self.CLASS_NAMES, predictions)
            },
        }

    def _mock_predict(self) -> dict:
        """
        Used ONLY when no trained model file is present, so the rest of the
        system (auth, database, app UI) can be built, demoed, and graded
        before the model finishes training. Replace by pointing
        LivestockDiseaseDetector(model_path=...) at a real .h5 file.
        """
        disease = random.choice(self.CLASS_NAMES)
        confidence = round(random.uniform(0.65, 0.97), 4)
        probs = {name: round(random.uniform(0.01, 0.3), 4) for name in self.CLASS_NAMES}
        probs[disease] = confidence
        return {
            "disease": disease,
            "confidence": confidence,
            "all_probabilities": probs,
            "mock": True,
        }



