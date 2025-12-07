import express from "express";
const router = express.Router();

router.post("/wf1/data-collect", async (req, res) => {
  try {
    const key = req.headers["x-api-key"];
    if (key !== "12345") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = {
      receivedAt: new Date().toISOString(),
      source: req.body.source || "unknown",
      status: "OK - backend active"
    };

    return res.json({
      ok: true,
      message: "WF1 data collected",
      data: payload
    });

  } catch (err) {
    console.error("WF1 error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
