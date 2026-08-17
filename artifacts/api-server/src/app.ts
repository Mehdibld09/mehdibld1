// @ts-nocheck
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app = express();

app.set("trust proxy", 1);

const PgSession = connectPgSimple(session);

const pinoMiddleware = (typeof pinoHttp === "function" ? pinoHttp : (pinoHttp as any).default) as typeof pinoHttp;
const sessionCookieDomain = process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined;

app.use(
  pinoMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      pool,
      createTableIfMissing: true,
      // Don't UPDATE the session row on every request just to bump `expire` —
      // that's an extra DB write per API call. Sessions already get a fresh
      // maxAge on login; this just stops the unnecessary churn.
      disableTouch: true,
    }),
    secret: process.env.SESSION_SECRET ?? (() => {
      if (process.env.NODE_ENV === "production") {
        console.warn("[WARN] SESSION_SECRET is not set — using fallback. Set SESSION_SECRET in your environment variables.");
      }
      return "steamshare-dev-secret";
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      // Set this to the shared parent domain (for example, ".steamfamily.gg")
      // when the main site and admin console use different subdomains.
      domain: sessionCookieDomain,
    },
  }),
);

// Rate limiting — prevent brute-force and race-condition abuse on sensitive endpoints
const redeemLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 5,                     // max 5 redemption attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/ad-links", redeemLimiter);
app.use("/api/premium/redeem", redeemLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minute window
  max: 20,                    // max 20 login/register attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

// Limit account uploads: max 10 new listings per IP per hour (applies to POST only)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: (req) => req.method !== "POST",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please wait before listing more accounts." },
});
app.use("/api/accounts", uploadLimiter);

app.use("/api", router);

// Static file serving in production (when not on Vercel)
const serveStatic = !process.env.VERCEL && process.env.NODE_ENV === "production";

if (serveStatic) {
  const distPublic = path.resolve(process.cwd(), "artifacts/steamshare/dist/public");
  const distRoot = path.resolve(process.cwd(), "dist/public");
  const staticDir = fs.existsSync(distPublic) ? distPublic : distRoot;

  app.use(express.static(staticDir));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Keep API failures JSON so the web client can finish its query state and
// display a useful retry action instead of waiting through a browser HTML error.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // Keep database failures actionable in production without returning the
  // underlying connection string, credentials, or SQL query to the client.
  const pgCode = typeof err?.code === "string" ? err.code : "";
  if (["28P01", "08001", "08003", "08004", "08006", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT"].includes(pgCode)) {
    logger.error(
      { err, method: req.method, url: req.originalUrl?.split("?")[0] },
      "Database connection error",
    );
    res.status(503).json({
      error: "Database connection failed. Verify the production DATABASE_URL and redeploy.",
    });
    return;
  }

  if (pgCode === "42P01") {
    logger.error(
      { err, method: req.method, url: req.originalUrl?.split("?")[0] },
      "Database schema error",
    );
    res.status(503).json({
      error: "Database schema is missing. Apply the project schema to the production database.",
    });
    return;
  }

  logger.error(
    { err, method: req.method, url: req.originalUrl?.split("?")[0] },
    "Unhandled API error",
  );
  res.status(500).json({ error: "Internal server error" });
});

export default app;
