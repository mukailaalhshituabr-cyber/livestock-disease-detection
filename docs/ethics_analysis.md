# Ethics Analysis

"Course/module, student name(s), and submission date are here."

This system gives farmers an AI-generated opinion about a potentially sick
animal. Getting it wrong has real consequences, a missed disease can mean
losing an animal or a farmer's livelihood; a false alarm can mean wasted
time and money. Use the prompts below to write a genuine analysis, not just
a checklist, for each section, argue "why" the current design is (or
isn't) good enough, and what the actual risk is if it fails.

## 1. Transparency

"The app shows a confidence score, a full probability breakdown per class,
and flags low-confidence/ambiguous results as "uncertain" rather than
asserting a single answer."

- Is showing a confidence number actually meaningful to a farmer with no
  ML background? What could be misread or over-trusted?
- What would we change about how results are presented?

## 2. Human Oversight

"The `vet_reviews` table lets a veterinarian confirm or correct any AI
diagnosis; the AI's output is never written as final/authoritative."

- In practice, how likely is a vet review to actually happen before a
  farmer acts on the result? What does the system do (or not do) to
  encourage that?
- What happens if no vet ever reviews a given prediction?

## 3. Fairness & Bias

"The trained model currently covers 2 of the 5 diseases listed in the
database (`Healthy`, `Lumpy Skin Disease`), trained on 936 cattle images.
Other diseases, species, and breeds are not represented in the training
data."

- Who is underserved by the current model (which species, which diseases,
  which regions' typical breeds)?
- What's the risk of a farmer trusting a result for a disease/species the
  model was never trained on?
- What would "fair enough to deploy" actually require here?

## 4. Privacy & Data Protection

"Row Level Security restricts each farmer to their own farms/animals/
predictions; images are stored per-user in Supabase Storage; veterinarians
and admins have broader read access for review purposes."

- Is farmer data (photos, location/region, animal records) sensitive
  enough to warrant more protection than is currently implemented?
- Who else, beyond the farmer, vet, and admin roles, might have access to
  this data in a real deployment (e.g. Supabase itself, hosting provider)?

## 5. Accountability & Harm

- If a farmer loses an animal after trusting an incorrect AI diagnosis,
  who is responsible, the developers, the vet who didn't review it in
  time, the farmer, no one?
- What safeguard in the current design most reduces this risk, and where
  is that safeguard still insufficient?

## 6. Recommendations

"Concrete, prioritized changes we'd make to this system before it could
responsibly be used by real farmers."

1. Training our model with real desease and healthy animal images
2. Making sure that the photos are really animales.
3. User data are secured.
4. 
