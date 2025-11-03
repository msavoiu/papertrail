require('dotenv').config();

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const AWS = require('aws-sdk');

const { onCall, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

// Document types configuration
const DOCUMENT_TYPES = {
  drivers_license: {
    requiresBothSides: true,
    estimatedTime: '2-3 weeks',
  },
  birth_certificate: {
    requiresBothSides: false,
    estimatedTime: '4-6 weeks',
  },
  social_security: {
    requiresBothSides: false,
    estimatedTime: '2-4 weeks',
  },
  passport: {
    requiresBothSides: false,
    estimatedTime: '6-8 weeks',
  },
  medical_records: {
    requiresBothSides: false,
    estimatedTime: '1-2 weeks',
  },
  insurance_card: {
    requiresBothSides: true,
    estimatedTime: '1-2 weeks',
  },
  disability_determination: {
    requiresBothSides: false,
    estimatedTime: '4-6 weeks',
  },
  medicaid_card: {
    requiresBothSides: true,
    estimatedTime: '2-3 weeks',
  },
  veterans_id: {
    requiresBothSides: true,
    estimatedTime: '3-4 weeks',
  },
  housing_voucher: {
    requiresBothSides: false,
    estimatedTime: '2-4 weeks',
  },
  snap_benefits: {
    requiresBothSides: true,
    estimatedTime: '1-2 weeks',
  },
  employment_records: {
    requiresBothSides: false,
    estimatedTime: '1-2 weeks',
  },
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

// Allowed MIME types (expanded to accept both formats)
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

// Helper function to extract file extension from MIME type or filename
function getFileExtension(fileType, fileName) {
  // If fileType is a MIME type (contains /)
  if (fileType && fileType.includes('/')) {
    const parts = fileType.split('/');
    const ext = parts[1].toLowerCase();
    // Handle special cases
    if (ext === 'jpeg') return 'jpg';
    return ext;
  }

  // If fileType is already an extension
  if (fileType) {
    return fileType.toLowerCase().replace('.', '');
  }

  // Fallback to fileName if provided
  if (fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'jpeg') return 'jpg';
    return ext;
  }

  return 'jpg';  // default fallback
}

// Helper function to get content type
function getContentType(fileType) {
  const lowerType = fileType.toLowerCase();

  // If already a MIME type, return it
  if (lowerType.includes('/')) {
    return lowerType;
  }

  // Convert extension to MIME type
  if (lowerType === 'pdf') return 'application/pdf';
  if (lowerType === 'png') return 'image/png';
  if (lowerType === 'jpg' || lowerType === 'jpeg') return 'image/jpeg';

  return 'application/octet-stream';  // fallback
}

exports.uploadDocument = functions.https.onCall(async (data, context) => {
      console.log('=== UPLOAD DOCUMENT FUNCTION CALLED ===');
      console.log('Auth context:', context.auth);
      console.log('Auth token:', context.auth?.token);
      console.log('User ID:', context.auth?.uid);
      console.log('Request data:', data);

      // Strict authentication check
      if (!context.auth) {
        console.error('No auth context provided');
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
      }

      const { uid } = context.auth;
      if (!uid) {
        console.error('No UID in auth context');
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User ID is required'
        );
      }

      const {
        documentId,
        fileData,
        fileType,
        side = 'front',
        isAdditionalFile = false,
        fileName,
      } = data;

      console.log('Document ID:', documentId);
      console.log('File type:', fileType);
      console.log('Side:', side);
      console.log('Is additional file:', isAdditionalFile);
      console.log('File data length:', fileData && fileData.length);

      // --- Validation section ---
      if (!documentId || !DOCUMENT_TYPES[documentId]) {
        console.error('Invalid document type:', documentId);
        throw new functions.https.HttpsError(
            'invalid-argument', 'Invalid document type');
      }

      // Validate file type (accept both MIME types and extensions)
      if (!fileType) {
        console.error('Missing file type');
        throw new functions.https.HttpsError(
            'invalid-argument', 'File type is required');
      }

      const normalizedType = fileType.toLowerCase();
      const isValidType = ALLOWED_MIME_TYPES.includes(normalizedType) ||
          ['pdf', 'jpg', 'jpeg', 'png'].includes(normalizedType);

      if (!isValidType) {
        console.error('Unsupported file type:', fileType);
        throw new functions.https.HttpsError(
            'invalid-argument',
            `Unsupported file type: ${fileType}. Allowed types: PDF, JPG, PNG`);
      }

      // Validate both sides requirement
      const docConfig = DOCUMENT_TYPES[documentId];
      if (docConfig.requiresBothSides && !isAdditionalFile &&
          side !== 'front' && side !== 'back' && side !== 'additional') {
        console.error('Invalid side for two-sided document:', side);
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Invalid side specified for document that requires both sides');
      }

      if (!fileData || typeof fileData !== 'string') {
        console.error('Missing or invalid file data');
        throw new functions.https.HttpsError(
            'invalid-argument', 'Missing or invalid file data');
      }

      let buffer;
      try {
        buffer = Buffer.from(fileData, 'base64');
        console.log('Buffer created, size:', buffer.length);
      } catch (err) {
        console.error('Base64 decode error:', err);
        throw new functions.https.HttpsError(
            'invalid-argument', 'Malformed file data - must be valid base64');
      }

      if (buffer.length > MAX_FILE_SIZE) {
        console.error('File too large:', buffer.length);
        throw new functions.https.HttpsError(
            'resource-exhausted',
            `File too large (${
                Math.round(
                    buffer.length / 1024 / 1024)}MB). Maximum size is 5MB`);
      }

      // Generate file path
      const timestamp = Date.now();
      const fileExtension = getFileExtension(fileType, fileName);

      const key = isAdditionalFile ?
          `user_uploads/${uid}/${documentId}/additional/${timestamp}.${
              fileExtension}` :
          `user_uploads/${uid}/${documentId}/${side}_${timestamp}.${
              fileExtension}`;

      console.log('S3 key:', key);

      // --- Upload to S3 ---
      try {
        console.log('Uploading to S3...');
        await s3
            .putObject({
              Bucket: bucket,
              Key: key,
              Body: buffer,
              ContentType: getContentType(fileType),
              Metadata: {
                userId: uid,
                documentId: documentId,
                side: side,
                uploadedAt: new Date().toISOString(),
              },
            })
            .promise();

        console.log('S3 upload successful');
      } catch (err) {
        console.error('S3 Upload Error:', err);
        throw new functions.https.HttpsError(
            'internal', `Failed to upload file: ${err.message}`);
      }

      // --- Save metadata in Firestore ---
      try {
        console.log('Saving metadata to Firestore...');

        // Update progress document
        const progressUpdate = {
          [documentId]: {
            status: 'completed',
            requestType: 'upload',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        };

        // Add file metadata based on type
        if (isAdditionalFile) {
          progressUpdate[documentId].additionalFiles =
              admin.firestore.FieldValue.arrayUnion(key);
        } else if (side === 'front') {
          progressUpdate[documentId].frontImage = key;
        } else if (side === 'back') {
          progressUpdate[documentId].backImage = key;
        }

        await admin.firestore()
            .collection('users')
            .doc(uid)
            .collection('documents')
            .doc('progress')
            .set(progressUpdate, {merge: true});

        console.log('Firestore metadata saved successfully');

        return {
          success: true,
          message: 'File uploaded successfully',
          s3Key: key,
          documentId: documentId,
          side: side,
        };
      } catch (err) {
        console.error('Firestore Save Error:', err);
        throw new functions.https.HttpsError(
            'internal', `Failed to save metadata: ${err.message}`);
      }
    });

// Function to request document replacement
exports.requestDocumentReplacement = onCall({ region: "us-west2" }, async (data, context) => {
      console.log('=== REQUEST DOCUMENT REPLACEMENT CALLED ===');
      console.log(
          'Auth context:',
          context.auth ? 'Authenticated' : 'Not authenticated');

      const {uid} = context.auth || {};
      if (!uid) {
        console.error('Authentication failed - no uid');
        throw new functions.https.HttpsError(
            'unauthenticated', 'User not authenticated');
      }

      const {documentId} = data;
      console.log('Document ID:', documentId);

      // Validate document type
      if (!documentId || !DOCUMENT_TYPES[documentId]) {
        console.error('Invalid document type:', documentId);
        throw new functions.https.HttpsError(
            'invalid-argument', 'Invalid document type');
      }

      try {
        console.log('Updating Firestore...');
        // Update document progress in Firestore
        await admin.firestore()
            .collection('users')
            .doc(uid)
            .collection('documents')
            .doc('progress')
            .set(
                {
                  [documentId]: {
                    status: 'in_progress',
                    requestType: 'request_replacement',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    estimatedTime: DOCUMENT_TYPES[documentId].estimatedTime,
                  },
                },
                {merge: true});

        console.log('Replacement request saved successfully');

        return {
          success: true,
          message: 'Replacement request submitted successfully',
          estimatedTime: DOCUMENT_TYPES[documentId].estimatedTime,
        };
      } catch (err) {
        console.error('Document replacement request error:', err);
        throw new functions.https.HttpsError(
            'internal', `Failed to submit replacement request: ${err.message}`);
      }
    });

// Function to get document progress
exports.getDocumentProgress = onCall({ region: "us-west2" }, async (data, context) => {
      console.log('=== GET DOCUMENT PROGRESS CALLED ===');

      const {uid} = context.auth || {};
      if (!uid) {
        console.error('Authentication failed - no uid');
        throw new functions.https.HttpsError(
            'unauthenticated', 'User not authenticated');
      }

      try {
        const progressDoc = await admin.firestore()
                                .collection('users')
                                .doc(uid)
                                .collection('documents')
                                .doc('progress')
                                .get();

        console.log('Progress document exists:', progressDoc.exists);
        return progressDoc.exists ? progressDoc.data() : {};
      } catch (err) {
        console.error('Error fetching document progress:', err);
        throw new functions.https.HttpsError(
            'internal', `Failed to fetch document progress: ${err.message}`);
      }
    });

// Function to update user profile data
exports.updateUserProfile = onCall({ region: "us-west2" }, async (data, context) => {
      console.log('=== UPDATE USER PROFILE CALLED ===');

      const {uid} = context.auth || {};
      if (!uid) {
        console.error('Authentication failed - no uid');
        throw new functions.https.HttpsError(
            'unauthenticated', 'User not authenticated');
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
      } = data;

      console.log('Updating profile for user:', uid);

      // Validation
      if (!firstName || typeof firstName !== 'string' ||
          firstName.trim().length === 0) {
        throw new functions.https.HttpsError(
            'invalid-argument', 'First name is required');
      }

      if (!lastName || typeof lastName !== 'string' ||
          lastName.trim().length === 0) {
        throw new functions.https.HttpsError(
            'invalid-argument', 'Last name is required');
      }

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        throw new functions.https.HttpsError(
            'invalid-argument', 'Valid email is required');
      }

      // Phone validation (optional field)
      if (phone &&
          (typeof phone !== 'string' || !/^\+?[\d-\s()]{10,}$/.test(phone))) {
        throw new functions.https.HttpsError(
            'invalid-argument', 'Invalid phone number format');
      }

      // Address validation (all address fields should be provided together)
      if (address || city || state || zipCode) {
        if (!address || !city || !state || !zipCode ||
            typeof address !== 'string' || typeof city !== 'string' ||
            typeof state !== 'string' || typeof zipCode !== 'string') {
          throw new functions.https.HttpsError(
              'invalid-argument',
              'All address fields (address, city, state, zipCode) must be provided');
        }

        // Basic ZIP code format validation
        if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
          throw new functions.https.HttpsError(
              'invalid-argument', 'Invalid ZIP code format');
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
            zipCode: zipCode.trim(),
          },
        }),
      };

      try {
        // Update user profile in Firestore
        await admin.firestore().collection('users').doc(uid).set(
            userData, {merge: true});

        console.log('Profile updated successfully');

        return {
          success: true,
          message: 'Profile updated successfully',
          profile: userData,
        };
      } catch (err) {
        console.error('Profile Update Error:', err);
        throw new functions.https.HttpsError(
            'internal', `Failed to update profile: ${err.message}`);
      }
    });