// @ts-nocheck
import express from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import passwordResetRouter from "./passwordReset";
import accountsRouter from "./accounts";
import commentsRouter from "./comments";
import usersRouter from "./users";
import adLinksRouter from "./adlinks";
import adminRouter from "./admin";
import statsRouter from "./stats";
import giveawaysRouter from "./giveaways";
import reportsRouter from "./reports";
import messagesRouter from "./messages";
import announcementsRouter from "./announcements";
import storeRouter from "./store";
import siteSettingsRouter from "./siteSettings";
import premiumRouter from "./premium";

const router = express.Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/auth", passwordResetRouter);
router.use("/accounts", accountsRouter);
router.use("/accounts/:accountId/comments", commentsRouter);
router.use("/users", usersRouter);
router.use("/ad-links", adLinksRouter);
router.use("/admin", adminRouter);
router.use(statsRouter);
router.use("/giveaways", giveawaysRouter);
router.use("/reports", reportsRouter);
router.use("/messages", messagesRouter);
router.use("/announcements", announcementsRouter);
router.use("/store", storeRouter);
router.use("/site-settings", siteSettingsRouter);
router.use("/premium", premiumRouter);

export default router;
