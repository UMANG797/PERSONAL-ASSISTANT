import { handleAuth, handleLogin } from "@auth0/nextjs-auth0";

export const dynamic = "force-dynamic";

export const GET = handleAuth({
  login: handleLogin({
    authorizationParams: {
      audience: process.env.AUTH0_AUDIENCE || "https://family-vault-api/",
      scope: "openid profile email"
    }
  }),
  signup: handleLogin({
    authorizationParams: {
      screen_hint: "signup",
      audience: process.env.AUTH0_AUDIENCE || "https://family-vault-api/",
      scope: "openid profile email"
    }
  })
});

