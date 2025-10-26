import express from "express";

// File handling
import multer from "multer";
import { PDFDocument, rgb } from "pdf-lib";

// S3 bucket
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// SETUP ----------------------------------------------------------------------------

dotenv.config();

const s3 = new S3Client({
    region: process.env.AWS_REGION | 'us-west-1'
});

// Multer setup (store file in memory)
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// ROUTES ---------------------------------------------------------------------------

router.post('/upload/:document/:userId', upload.array('files'), async (req, res) => {
    try {
        const { document, userId } = req.params;

        // Retrieve and check file
        const files = req.files;
        
        if (!files) {
            return res.status(400).json({ message: "No file(s) uploaded." });
        }

        const convertedFile = convertToPDF(file);

        // 5. Upload to S3 bucket
        const key = `user_uploads/${userId}/${document}.pdf`;
        
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: convertedFile,
            ContentType: "application/pdf",
            ServerSideEncryption: "aws:kms", // SSE-KMS
            SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
        });

        await s3.send(command);

        return res.status(201).json({
            message: "Document uploaded successfully.",
            path: key,
        });

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "Server error" })
    }
});

router.get('/get/:document/:userId', async (req, res) => {
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

router.put('/update/:document/:userId', upload.array('files'), async (req, res) => {
    try {
        const { document, userId } = req.params;

        // Retrieve and check file
        const files = req.files;
        if (!files) {
            return res.status(400).json({ message: "No file(s) uploaded." });
        }

        // TODO: GET CURRENT DOCUMENT KEY USING FIREBASE
        const deleteCommand = new DeleteObjectCommand({
            bucket: process.env.AWS_S3_BUCKET_NAME,
            key: null // FROM FIREBASE
        });

        await s3.send(deleteCommand);

        const convertedFile = convertToPDF(files);

        const key = `user_uploads/${userId}/${document}.pdf`;
        
        const uploadCommand = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Body: convertedFile,
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

router.delete('/delete/:document/:userId', async (req, res) => {
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

export default router;

// FUNCTIONS ------------------------------------------------------------------------

async function convertToPDF(files) {
    try {
        // 1. Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // 2. Embed the uploaded images into separate pages
        for (const file of files) {
            if (file.mimetype !== "image/png") {
                throw new Error("Only PNG images are allowed.");
            }

            // Embed the PNG image
            const embeddedImage = await pdfDoc.embedPng(file.buffer);
            const { width, height } = embeddedImage;

            // Add a new page with the same dimensions as the image
            const page = pdfDoc.addPage([width, height]);

            // Draw the image onto the page
            page.drawImage(embeddedImage, {
                x: 0,
                y: 0,
                width,
                height,
            });
        }

        // 4. Save the PDF to a buffer
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;

    } catch (error) {
        console.error(error.message);
        return res.json({ status: 500 }, { message: "Failed to convert image(s) to PDF" })
    }
}
