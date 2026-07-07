"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireMultiTenancy = exports.validateJwt = void 0;
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
// Configures JWT validation via Auth0
exports.validateJwt = (0, express_oauth2_jwt_bearer_1.auth)({
    audience: process.env.AUTH0_AUDIENCE || "https://family-vault-api/",
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || "https://YOUR_AUTH0_DOMAIN.auth0.com/",
    tokenSigningAlg: "RS256"
});
// Middleware to extract user identity from validated Auth0 sub claim
const requireMultiTenancy = (req, res, next) => {
    // express-oauth2-jwt-bearer stores payload under req.auth
    const authPayload = req.auth?.payload;
    if (!authPayload || !authPayload.sub) {
        return res.status(401).json({ error: "Unauthorized access: Tenant identification claims missing." });
    }
    // Bind tenant identifier for subsequent database queries
    req.auth0UserId = authPayload.sub;
    next();
};
exports.requireMultiTenancy = requireMultiTenancy;
