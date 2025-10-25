import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    region: process.env.AWS_REGION
});

router.post('/update/:document/:userId', verifyToken, async (req, res) => {
    try {
        const { document, userId } = req.params;

        // TODO: GET CURRENT DOCUMENT KEY USING FIREBASE
        const deleteCommand = new DeleteObjectCommand({
            bucket: process.env.AWS_S3_BUCKET_NAME,
            key: null // FROM FIREBASE
        });

        await s3.send(deleteCommand);

        // Change later to read from React Native image upload library
        const fileStream = fs.createReadStream(filePath);

        const key = `user_uploads/${userId}/${document}_{timestamp}.pdf`;
        
        const uploadCommand = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: fileStream,
            ContentType: "application/pdf",
            ServerSideEncryption: "aws:kms", // SSE-KMS
            SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
        });
        
        // Upload to S3 bucket
        await s3.send(uploadCommand);

        return res.json({ status: 200 }, { path: key, message: "Document updated successfully." });

    } catch (error) {
        console.error(error.message);
        return res.json({ status: 500 }, { message: "Document failed to update" })
    }
});

module.exports = router;
