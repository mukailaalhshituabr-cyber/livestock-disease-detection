"""
Verifies the access token that the React Native app receives from Supabase
Auth after login. This backend does NOT issue its own tokens - Supabase
already handles registration, login, OTP verification, and password reset.

IMPORTANT: This does NOT use a JWT secret. Supabase has been rolling out
asymmetric JWT signing since October 2025, and many current projects don't
expose a shared secret at all. Even for projects still on the legacy
shared-secret (HS256) signing, Supabase's own docs now recommend verifying
by asking the Auth server directly rather than managing that secret
yourself: https://supabase.com/docs/guides/auth/jwts

So instead of decoding the token locally, we hand it to Supabase's
auth.get_user() call, which asks the Auth server "is this token valid, and
if so, who is it for?". This only needs the public project URL + anon key
(the same ones already in the mobile app), works regardless of which
signing algorithm the project uses, and keeps working automatically if
Supabase changes its signing setup again in the future.
"""
import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

security = HTTPBearer()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

_supabase_client: Client | None = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    _supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials

    if _supabase_client is None:
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env",
        )

    try:
        response = _supabase_client.auth.get_user(token)
        user = response.user
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {"id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")
