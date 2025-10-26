require("dotenv").config();

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const AWS = require("aws-sdk");

// Read from process.env
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const bucket = process.env.AWS_S3_BUCKET;

admin.initializeApp();

// Max upload size = 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_FILE_TYPES = ["pdf", "jpg", "jpeg", "png"];

exports.uploadDocument = functions.https.onCall(async (data, context) => {
  const {uid} = context.auth || {};
  if (!uid) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "User not authenticated");
  }

  const {label, fileData, fileType, category} = data;

  // --- Validation section ---
  if (!label || typeof label !== "string") {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid label");
  }

  if (!fileType || !ALLOWED_FILE_TYPES.includes(fileType.toLowerCase())) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid or unsupported file type");
  }

  if (!fileData || typeof fileData !== "string") {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid file data");
  }

  // Sanitize label (no slashes or special chars)
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");

  let buffer;
  try {
    buffer = Buffer.from(fileData, "base64");
  } catch (err) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Malformed file data");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new functions.https.HttpsError(
        "resource-exhausted",
        "File too large (max 5MB)");
  }

  const key = `user_uploads/${uid}/${safeLabel}.${fileType.toLowerCase()}`;

  // --- Upload to S3 ---
  try {
    await s3
        .putObject({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType:
          fileType === "pdf" ? "application/pdf" :
            `image/${fileType.toLowerCase()}`,
        })
        .promise();
  } catch (err) {
    console.error("S3 Upload Error:", err);
    throw new functions.https.HttpsError("internal", "Failed to upload file");
  }

  // --- Save metadata in Firestore ---
  try {
    const docRef = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("documents")
        .add({
          name: safeLabel,
          fileType: fileType.toLowerCase(),
          category: category || "uncategorized",
          key,
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    return {message: "File uploaded successfully", docId: docRef.id};
  } catch (err) {
    console.error("Firestore Save Error:", err);
    throw new functions.https.HttpsError("internal", "Failed to save metadata");
  }
});
