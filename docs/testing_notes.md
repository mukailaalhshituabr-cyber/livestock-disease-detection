# Testing Notes

"Course/module, student name(s), and submission date are here."

## 1. Test Environment

| Item | Value |
|---|---|
| Backend | FastAPI, run locally via `uvicorn`, Python venv |
| Frontend | Expo Go on: "[fill in, Web browser, Android/iOS, device model or emulator]" |
| Supabase project | "[project ref / environment name]" |
| Model in use | `best_model.h5` (2 classes: Healthy, Lumpy Skin Disease) |

## 2. Bugs Found During Development (log)

"Factual record of real issues hit and fixed during build/test, we will add to this table as we find more."

| # | Symptom | Root Cause | Fix |
|---|---|---|---|
| 1 | Backend rejected valid login tokens with "unverifiable JWT / keyfunc kid" error | `frontend/lib/supabase.js` and `backend/.env` pointed at two different Supabase projects, so the token was signed by keys the backend wasn't checking against | Updated both to reference the same project |
| 2 | `npx expo start` crashed with `Cannot find module 'expo/config-plugins'` | `frontend/package.json` had `expo` pinned to a much older version (`^46.0.21`) than the rest of the dependencies (`react-native@0.86`, `expo-image-picker@57.x`), so the actually-installed packages were internally inconsistent | Corrected the `expo` version and did a clean `node_modules` reinstall |
| 3 | Supabase Dashboard "Add user" failed with `{}` / "null value in column first_name ... violates not-null constraint" | The `on_auth_user_created` trigger required `first_name`/`last_name` from signup metadata, but the Dashboard's simplified Add User form doesn't collect metadata at all | Made the trigger fall back to placeholder names when metadata is missing |
| 4 | Sign up / manual user creation failed with "email rate limit exceeded" | Supabase's default built-in mailer has a low rate limit, easy to hit while testing repeatedly | Documented as a known platform limit; recommended a custom SMTP provider for real use |
| 5 | Camera button behavior unclear/inconsistent across devices | "[fill in what we found once retested after the dependency fix, did it resolve, or was there a separate cause?]" | |

## 3. Manual Test Cases

"Fill in as we test each screen. Mark Pass/Fail and note anything odd,
even if we fix it, the log itself is evidence of testing rigor."

### Auth (`AuthScreen.js`)

| Test | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Register with valid details | | Account created, OTP screen shown | | |
| Register with mismatched passwords | | Error shown, no account created | | |
| Verify with correct OTP | | Logged in / redirected to login | | |
| Verify with wrong OTP | | Error shown, can retry | | |
| Resend OTP | | New code received | | |
| Login with correct credentials | | Enters app | | |
| Login with wrong password | | "Invalid login credentials" error | | |
| Login before email confirmed | | Blocked / prompted to verify | | |
| Forgot password flow | | Reset email received, password changed successfully | | |

### Farm (`FarmScreen.js`)

| Test | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Add a farm | | Appears in list | | |
| Add an animal to a farm | | Appears under that farm | | |

### Detection (`DetectionScreen.js`)

| Test | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Take/select a real animal photo | | Disease prediction shown with confidence | | |
| Submit a non-animal photo (e.g. a wall, a random object) | | "No animal detected" message, no prediction saved | | |
| Submit a borderline/ambiguous photo | | "Uncertain result" flagged | | |
| Detect without selecting an animal first | | Blocked with a clear error | | |

### History (`HistoryScreen.js`)

| Test | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| View past predictions | | List matches what was actually submitted | | |
| Prediction with a vet review | | Review status shown | | |

### Profile (`ProfileScreen.js`)

| Test | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| View account info | | Correct name/email/role/region shown | | |
| Log out | | Confirmation prompt, then returns to login screen | | |
| Log back in after logout | | Session works normally | | |

## 4. Known Limitations at Time of Testing

- Disease model only classifies 2 of 5 diseases in `diseases` (see README)
