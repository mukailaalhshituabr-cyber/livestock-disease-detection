# AI Livestock Disease Detection System
An AI-powered mobile app that helps farmers in Niger detect livestock diseases
early by photographing a sick animal and getting an instant, AI-generated diagnosis with a confidence score and next-step recommendation.

Link to app: https://livestock-disease-detection.vercel.app 
Overview

- Problem: Livestock diseases are often caught too late because
  veterinary services are far away, causing farmers to lose animals and income.
- Solution: A farmer photographs their animal in the app. The photo is
  first checked to confirm it's actually an animal, then a CNN
  (Convolutional Neural Network) classifies it into a known disease and
  gives a confidence score and recommendation. A veterinarian can later
  review and confirm or correct any AI diagnosis.

Architecture

```
React Native App (Expo)
   │
   ├──► Supabase          (Auth, Postgres database, image storage...)
   │
   └──► FastAPI service   (runs ONLY the CNN models, /api/predict)
            │
            ├─ 1. Animal-detection gate  (pretrained ImageNet MobileNetV2)
            └─ 2. Disease classifier     (custom-trained MobileNetV2 head)
```

Authentication, user profiles, farms, animals, and the disease/prediction
records all live in Supabase. The Python/FastAPI backend does nothing except
receive an image and an auth token, verify the token, run the two-stage
model pipeline, and return a prediction, it never stores anything
permanently (the app writes the result to Supabase itself).

Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Mobile app | React Native + Expo | Camera/gallery capture, UI, navigation |
| Navigation | React Navigation (stack + bottom tabs) | Screen routing |
| Backend-as-a-Service | Supabase (Auth, Postgres, Storage) | Users, data, images |
| AI inference service | FastAPI + Uvicorn (Python) | Exposes `/api/predict` |
| AI framework | TensorFlow / Keras | Builds and runs the CNNs |
| AI model | MobileNetV2 (transfer learning) | Disease classification |
| AI safeguard | MobileNetV2 (pretrained ImageNet, unmodified) | "Is this even an animal?" gate |
| Image handling | Pillow, NumPy | Decoding/resizing images, tensor math |

Database Design

See `database/schema.sql` (single source of truth, includes the RLS-recursion
fix and all disease reference rows). Summary of tables:

| Table | Purpose |
|---|---|
| `regions` | Niger's 8 administrative regions (reference data) |
| `profiles` | Extends Supabase's `auth.users` with first/last name, role (farmer/veterinarian/admin), region, phone |
| `farms` | A farmer's farm(s), name, region, GPS |
| `animals` | Livestock owned by a farm, species, breed, tag ID, sex, DOB |
| `diseases` | Reference table: disease name, symptoms, recommended action, severity |
| `predictions` | Each AI diagnosis, linked to a specific animal |
| `vet_reviews` | A veterinarian's confirmation or correction of an AI prediction (human oversight) |

Row Level Security (RLS) ensures farmers only ever see their own farms,
animals, and predictions, while veterinarians and admins can see across
the whole system for review purposes. Role checks go through a
`SECURITY DEFINER` function (`get_user_role()`) rather than querying
`profiles` directly from inside a `profiles` policy, which avoids infinite
recursion in Postgres's policy evaluation.

Other SQL files:
- `database/storage_setup.sql`, Supabase Storage bucket + access policies for livestock photos.
- `database/backfill_missing_profiles.sql`, repair script for any `auth.users` row that's missing its matching `profiles` row.

Setup Instructions
How Detection Works

When a photo is submitted to `/api/predict`, it goes through two stages
(`backend/app/ml/model.py`):

1. Animal-detection gate. The photo is run through MobileNetV2
   "pretrained on ImageNet as-is", no extra training data needed. ImageNet's
   1000 classes are ordered so all animal categories occupy indices 0–397;
   the code sums the model's predicted probability across just those
   indices. If that "animalness" score is too low, the photo is rejected
   (e.g. a photo of a wall, a person, a document) before the disease model
   ever sees it.
2. Disease classification. If it passed the gate, the photo goes through
   the custom-trained model: MobileNetV2's convolutional base (frozen,
   pretrained) → `GlobalAveragePooling2D` → `Dense(128, relu)` →
   `Dropout(0.3)` → `Dense(softmax)`. Only this small head was trained on
   the labeled dataset in `backend/data/`.
3. Confidence & uncertainty check. Alongside the top prediction, the
   code checks the margin between the top-2 class probabilities. A result
   with a narrow margin (the model is basically torn between two classes)
   is flagged `uncertain`, even if the raw confidence number looks
   passable, rather than asserting a false-confident answer.

Training the Model

`backend/data/` currently has:

| Class | Images |
|---|---|
| `Healthy` | 515 |
| `Lumpy Skin Disease` | 421 |

The training script automatically supports any number of classes, it
reads whatever subfolders exist under `--data-dir`, trains, and saves a
`<output>.classes.json` sidecar recording the class order, so `model.py`
always maps predictions back to the right disease names. Subfolder names
must exactly match the `name` column in the `diseases` table
(`database/schema.sql`).

⚠️ Current limitation: the model can only predict the classes it was
trained on. `diseases` also lists Foot and Mouth Disease, Mastitis, and
Bovine Respiratory Disease, but there's no training data for them yet, so
the model can never output those labels until labeled image sets are added
for each. Also worth noting for our report: Mastitis and especially
Bovine Respiratory Disease are not strongly visual diseases (BRD is
diagnosed mainly from coughing/breathing/behavior), a photo-only CNN may
have an inherent ceiling on those regardless of dataset size.

Security Features

- Supabase Auth: email/password + email OTP verification, password reset,
  logout, JWT session tokens (industry standard, not hand-rolled).
- FastAPI inference route requires a valid Supabase session token
  (`Authorization: Bearer <token>`), verified by asking the Supabase Auth
  server directly (`auth.get_user()`) rather than managing a JWT secret.
- Row Level Security on every table, a farmer can only read/write their own
  data; role checks use a `SECURITY DEFINER` function to avoid RLS recursion.
- Image uploads are scoped to `{user_id}/...` storage folders, a user cannot
  overwrite or delete another user's images.
- The animal-detection gate and uncertainty flag act as basic input/output
  safeguards, the model doesn't force a confident-sounding answer onto
  clearly out-of-scope photos or genuinely ambiguous cases.

Ethical Considerations (for our report)

- Transparency: every prediction shows a confidence score and the model's
  full probability breakdown, not just a single verdict; low-confidence or
  ambiguous results are explicitly labeled uncertain rather than asserted.
- Human oversight: the `vet_reviews` table lets a real veterinarian
  confirm or correct any AI diagnosis, the system never has the final word.
- Fairness/bias: disease classes and symptoms are documented in the
  `diseases` table; note in our report which species/breeds/diseases the
  training data does and doesn't cover (currently only cattle, only 2 of 5
  listed diseases).
- Privacy: each farmer's animals and images are access-controlled by RLS
  and Storage policies, not visible to other farmers.

AI Tool Declaration

This project's code scaffolding (the animal-detection gate, and
confidence/uncertainty handling) was generated with assistance from chat AI, and fixing multiple errors that we couldn't identify ourselves.


Project Structure

```
livestock-disease-detection/
├── .gitignore
├── README.md
│
├── docs/                              
│   ├── ethics_analysis.md            , The documentations
│   ├── testing_notes.md              
│   ├── AI_Use_Declaration_Form       
├── database/
│   ├── schema.sql                    , tables, RLS policies, triggers
│   ├── storage_setup.sql             , Supabase Storage bucket/policies
│   └── backfill_missing_profiles.sql , one-off repair script
│
├── backend/                           (FastAPI inference service)
│   ├── .env                          , Supabase URL/key, MODEL_PATH (gitignored)
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── train_model.py                , CLI to train the CNN on backend/data/
│   ├── best_model.h5                 , trained model weights
│   ├── best_model.classes.json       , ["Healthy", "Lumpy Skin Disease"]
│   ├── app/
│   │   ├── main.py                   , FastAPI app entrypoint
│   │   ├── auth/
│   │   │   └── supabase_auth.py      , verifies Supabase JWTs via auth.get_user()
│   │   ├── ml/
│   │   │   └── model.py              , LivestockDiseaseDetector: animal gate + disease CNN
│   │   └── routes/
│   │       └── model_routes.py       , POST /api/predict
│   └── data/                         , training images
│       ├── Healthy/                   (515 images)
│       └── Lumpy Skin Disease/        (421 images)
│
└── frontend/                          (React Native + Expo app)
    ├── App.js                        , navigation root, session gate
    ├── app.json                      , Expo config, camera/gallery permission plugin
    ├── package.json
    ├── assets/                        (empty)
    ├── components/                    (empty)
    ├── lib/
    │   ├── supabase.js               , Supabase client + inference URL config
    │   └── alert.js                  , cross-platform alert/confirm helper
    └── screens/
        ├── AuthScreen.js             , login / register / OTP / password reset
        ├── FarmScreen.js             , manage farms & animals
        ├── DetectionScreen.js        , camera/gallery → AI prediction
        ├── HistoryScreen.js          , past predictions + vet reviews
        └── ProfileScreen.js          , account info + log out
```
Link to app: https://livestock-disease-detection.vercel.app 