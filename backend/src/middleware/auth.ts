import { auth, ClaimCheck } from "express-oauth2-jwt-bearer";
import { Request, Response, NextFunction } from "express";

// Extends Express Request type definition to include verified Auth0 claims
declare global {
  namespace Express {
    interface Request {
      auth0UserId?: string;
    }
  }
}

// Configures JWT validation via Auth0
export const validateJwt = auth({
  audience: process.env.AUTH0_AUDIENCE || "https://family-vault-api/",
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || "https://YOUR_AUTH0_DOMAIN.auth0.com/",
  tokenSigningAlg: "RS256"
});

// Middleware to extract user identity from validated Auth0 sub claim
export const requireMultiTenancy = (req: Request, res: Response, next: NextFunction) => {
  // express-oauth2-jwt-bearer stores payload under req.auth
  const authPayload = (req as any).auth?.payload;
  
  if (!authPayload || !authPayload.sub) {
    return res.status(401).json({ error: "Unauthorized access: Tenant identification claims missing." });
  }

  // Bind tenant identifier for subsequent database queries
  req.auth0UserId = authPayload.sub;
  next();
};
