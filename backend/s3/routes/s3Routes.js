import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    region: process.env.AWS_REGION
});

router.post('/upload/:document/:userId', verifyToken, async (req, res) => {
    try {
        const { document, userId }= req.params;

        // Change later to read from React Native image upload library
        const fileStream = fs.createReadStream(filePath);

        const key = `user_uploads/${userId}/${document}.pdf`;
        
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

router.get('/get/:document/:userId', verifyToken, async (req, res) => {
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

router.put('/update/:document/:userId', verifyToken, async (req, res) => {
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

        const key = `user_uploads/${userId}/${document}.pdf`;
        
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

router.delete('/delete/:document/:userId', verifyToken, async (req, res) => {
    try {
        const { document, userId } = req.params;

        // TODO: GET CURRENT DOCUMENT KEY USING FIREBASE
        const deleteCommand = new DeleteObjectCommand({
            bucket: process.env.AWS_S3_BUCKET_NAME,
            key: null // FROM FIREBASE
        });

        await s3.send(deleteCommand);

        return res.json({ status: 204 }, { path: key, message: "Document deleted successfully." });

    } catch (error) {
        console.error(error.message);
        return res.json({ status: 500 }, { message: "Document failed to delete" })
    }
});

module.exports = router;
