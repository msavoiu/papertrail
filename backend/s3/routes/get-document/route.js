import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    region: process.env.AWS_REGION
});

router.post('/get/:document/:userId', verifyToken, async (req, res) => {
    try {
        const { document, userId } = req.params;

        // TODO: GET CURRENT DOCUMENT KEY USING FIREBASE. NEEDED TO SIGN URL.
        const key = null;

        const response = await fetch(`/auth/sign-url/${key}`); // pass in key through parameters
        const { url, expiresIn } = await response.json();

        return res.json({ status: 200 }, { path: url, message: "Document retrieved successfully." });

    } catch (error) {
        console.error(error.message);
        return res.json({ status: 500 }, { message: "Failed to retreive document" })
    }
});

module.exports = router;
