import express from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
    region: process.env.AWS_REGION
});

const router = express.Router();

// Secure: require your app auth middleware before this route!
router.get("/auth/sign-url/:key", async (req, res) => {
    try {
        const { key } = req.params; // e.g. "patients/1234.png"
        if (!key) return res.status(400).json({ error: "Missing key" });

        // Optional: validate user has access to this object (authz)
        // e.g. check req.user.id matches object owner

        const cmd = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
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
