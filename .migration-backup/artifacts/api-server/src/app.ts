// @ts-nocheck
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    }),
    secret: process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production"
      ? (() => { throw new Error("SESSION_SECRET env var is required in production"); })()
      : "steamshare-dev-secret"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
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
app.use("/api/adlinks", redeemLimiter);
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

app.use("/api", router);

// Vercel serves the Vite build from outputDirectory; express.static is ignored there.
const serveStatic = !process.env.VERCEL;

if (serveStatic) {
  const staticDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../steamshare/dist",
  );

  app.use(express.static(staticDir));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
