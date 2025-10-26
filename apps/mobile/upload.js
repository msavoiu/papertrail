// apps/mobile/upload.js
import { getToken } from './auth';

export async function uploadDocument(fileUri, label) {
  const token = await getToken();

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: `${label}.pdf`,
    type: 'application/pdf'
  });
  formData.append('label', label);

  const response = await fetch(
    'https://us-central1-papertrail-23c00.cloudfunctions.net/uploadDocument',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    }
  );

  const data = await response.json();
  console.log('Upload response:', data);
  return data;
}