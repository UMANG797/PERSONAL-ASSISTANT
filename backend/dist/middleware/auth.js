"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireMultiTenancy = exports.validateJwt = void 0;
const auth_1 = require("../routes/auth");
// Custom JWT verification middleware replacing Auth0 validation
const validateJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing token." });
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = (0, auth_1.verifyJwt)(token);
        req.auth = { payload };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token.", details: err.message });
    }
};
exports.validateJwt = validateJwt;
// Middleware to extract user identity from custom JWT payload
const requireMultiTenancy = (req, res, next) => {
    const authPayload = req.auth?.payload;
    if (!authPayload || !authPayload.userId) {
        return res.status(401).json({ error: "Unauthorized access: User identification claims missing." });
    }
    // Bind tenant identifier for subsequent database queries
    req.auth0UserId = authPayload.userId;
    next();
};
exports.requireMultiTenancy = requireMultiTenancy;
