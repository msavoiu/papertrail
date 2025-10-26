require("dotenv").config();

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const AWS = require("aws-sdk");

// Document types configuration
const DOCUMENT_TYPES = {
  drivers_license: {
    requiresBothSides: true,
    estimatedTime: "2-3 weeks"
  },
  birth_certificate: {
    requiresBothSides: false,
    estimatedTime: "4-6 weeks"
  },
  social_security: {
    requiresBothSides: false,
    estimatedTime: "2-4 weeks"
  },
  passport: {
    requiresBothSides: false,
    estimatedTime: "6-8 weeks"
  },
  medical_records: {
    requiresBothSides: false,
    estimatedTime: "1-2 weeks"
  },
  insurance_card: {
    requiresBothSides: true,
    estimatedTime: "1-2 weeks"
  },
  disability_determination: {
    requiresBothSides: false,
    estimatedTime: "4-6 weeks"
  },
  medicaid_card: {
    requiresBothSides: true,
    estimatedTime: "2-3 weeks"
  },
  veterans_id: {
    requiresBothSides: true,
    estimatedTime: "3-4 weeks"
  },
  housing_voucher: {
    requiresBothSides: false,
    estimatedTime: "2-4 weeks"
  },
  snap_benefits: {
    requiresBothSides: true,
    estimatedTime: "1-2 weeks"
  },
  employment_records: {
    requiresBothSides: false,
    estimatedTime: "1-2 weeks"
  }
};

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

  const {
    documentId,
    fileData,
    fileType,
    side = 'front',
    isAdditionalFile = false
  } = data;

  // --- Validation section ---
  if (!documentId || !DOCUMENT_TYPES[documentId]) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid document type");
  }

  if (!fileType || !ALLOWED_FILE_TYPES.includes(fileType.toLowerCase())) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid or unsupported file type");
  }

  // Validate both sides requirement
  const docConfig = DOCUMENT_TYPES[documentId];
  if (docConfig.requiresBothSides && side !== 'front' && side !== 'back') {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid side specified for document that requires both sides");
  }

  if (!fileData || typeof fileData !== "string") {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid file data");
  }

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

  const timestamp = Date.now();
  const key = isAdditionalFile
    ? `user_uploads/${uid}/${documentId}/additional/${timestamp}.${fileType.toLowerCase()}`
    : `user_uploads/${uid}/${documentId}/${side}_${timestamp}.${fileType.toLowerCase()}`;

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
    // Update progress document
    const progressUpdate = {
      [documentId]: {
        status: "completed",
        requestType: "upload",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }
    };

    // Add file metadata based on type
    if (isAdditionalFile) {
      progressUpdate[documentId].additionalFiles = admin.firestore.FieldValue.arrayUnion(key);
    } else if (side === 'front') {
      progressUpdate[documentId].frontImage = key;
    } else if (side === 'back') {
      progressUpdate[documentId].backImage = key;
    }

    const docRef = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("documents")
        .doc("progress")
        .set(progressUpdate, {merge: true});

    return {message: "File uploaded successfully", docId: docRef.id};
  } catch (err) {
    console.error("Firestore Save Error:", err);
    throw new functions.https.HttpsError("internal", "Failed to save metadata");
  }
});

// Function to request document replacement
exports.requestDocumentReplacement = functions.https.onCall(async (data, context) => {
  const {uid} = context.auth || {};
  if (!uid) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "User not authenticated"
    );
  }

  const {documentId} = data;

  // Validate document type
  if (!documentId || !DOCUMENT_TYPES[documentId]) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid document type"
    );
  }

  try {
    // Update document progress in Firestore
    await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("documents")
        .doc("progress")
        .set({
          [documentId]: {
            status: "in_progress",
            requestType: "request_replacement",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            estimatedTime: DOCUMENT_TYPES[documentId].estimatedTime
          }
        }, {merge: true});

    return {
      message: "Replacement request submitted successfully",
      estimatedTime: DOCUMENT_TYPES[documentId].estimatedTime
    };
  } catch (err) {
    console.error("Document replacement request error:", err);
    throw new functions.https.HttpsError(
        "internal",
        "Failed to submit replacement request"
    );
  }
});

// Function to get document progress
exports.getDocumentProgress = functions.https.onCall(async (data, context) => {
  const {uid} = context.auth || {};
  if (!uid) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "User not authenticated"
    );
  }

  try {
    const progressDoc = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("documents")
        .doc("progress")
        .get();

    return progressDoc.exists ? progressDoc.data() : {};
  } catch (err) {
    console.error("Error fetching document progress:", err);
    throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch document progress"
    );
  }
});

// Function to update user profile data
exports.updateUserProfile = functions.https.onCall(async (data, context) => {
  const {uid} = context.auth || {};
  if (!uid) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "User not authenticated"
    );
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    zipCode
  } = data;

  // Validation
  if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "First name is required"
    );
  }

  if (!lastName || typeof lastName !== "string" || lastName.trim().length === 0) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Last name is required"
    );
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Valid email is required"
    );
  }

  // Phone validation (optional field)
  if (phone && (typeof phone !== "string" || !/^\+?[\d-\s()]{10,}$/.test(phone))) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid phone number format"
    );
  }

  // Address validation (all address fields should be provided together)
  if (address || city || state || zipCode) {
    if (!address || !city || !state || !zipCode ||
        typeof address !== "string" || typeof city !== "string" ||
        typeof state !== "string" || typeof zipCode !== "string") {
      throw new functions.https.HttpsError(
          "invalid-argument",
          "All address fields (address, city, state, zipCode) must be provided"
      );
    }

    // Basic ZIP code format validation
    if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
      throw new functions.https.HttpsError(
          "invalid-argument",
          "Invalid ZIP code format"
      );
    }
  }

  // Prepare user data object
  const userData = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(phone && {phone: phone.trim()}),
    ...(address && {
      address: {
        street: address.trim(),
        city: city.trim(),
        state: state.toUpperCase().trim(),
        zipCode: zipCode.trim()
      }
    })
  };

  try {
    // Update user profile in Firestore
    await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .set(userData, {merge: true});

    return {
      message: "Profile updated successfully",
      profile: userData
    };
  } catch (err) {
    console.error("Profile Update Error:", err);
    throw new functions.https.HttpsError(
        "internal",
        "Failed to update profile"
    );
  }
});