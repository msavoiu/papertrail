import express from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../../../s3Client.js";

const router = express.Router();

// Secure: require your app auth middleware before this route!
router.get("/presign", async (req, res) => {
    try {
        const { key } = req.query; // e.g. "patients/1234.png"
        if (!key) return res.status(400).json({ error: "Missing key" });

        // Optional: validate user has access to this object (authz)
        // e.g. check req.user.id matches object owner

        const cmd = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
        });

        // Short expiry for PHI
        const url = await getSignedUrl(s3, cmd, { expiresIn: 120 }); // 120 seconds
        res.json({ url, expiresIn: 120 });
    } catch (err) {
        console.error("presign err", err);
        res.status(500).json({ error: "Failed to create presigned URL" });
    }
});

export default router;
