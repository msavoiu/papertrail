import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    region: process.env.AWS_REGION
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
