import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    region: process.env.AWS_REGION
});

router.post('/get/:document/:userId', verifyToken, async (req, res) => {
    try {
        const { document, userId }= req.params;

        // Change later to read from React Native image upload library
        const fileStream = fs.createReadStream(filePath);

        const key = `user_uploads/${userId}/${document}_{timestamp}.pdf`;
        
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: fileStream,
            ContentType: "application/pdf",
            ServerSideEncryption: "aws:kms", // SSE-KMS
            SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
        });
        
        // Upload to S3 bucket
        await s3.send(command);
    
        return res.json({ status: 201 }, { path: key, message: "Document uploaded successfully." });
        
    } catch (error) {
        console.error(error.message);
        return res.json({ status: 500 }, { message: "Server error" })
    }
});

module.exports = router;
