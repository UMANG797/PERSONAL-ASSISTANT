import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../routes/auth";

// Extends Express Request type definition to include verified user claims
declare global {
  namespace Express {
    interface Request {
      auth0UserId?: string;
    }
  }
}

// Custom JWT verification middleware replacing Auth0 validation
export const validateJwt = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyJwt(token);
    (req as any).auth = { payload };
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token.", details: err.message });
  }
};

// Middleware to extract user identity from custom JWT payload
export const requireMultiTenancy = (req: Request, res: Response, next: NextFunction) => {
  const authPayload = (req as any).auth?.payload;
  
  if (!authPayload || !authPayload.userId) {
    return res.status(401).json({ error: "Unauthorized access: User identification claims missing." });
  }

  // Bind tenant identifier for subsequent database queries
  req.auth0UserId = authPayload.userId;
  next();
};
