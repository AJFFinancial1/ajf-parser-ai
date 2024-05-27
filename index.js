const express = require('express');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const stream = require('stream');

const app = express();
app.use(express.json());

// Load Google Drive API credentials from service account JSON file
const serviceAccount = require('./serviceAccount.json');

// Set up Google Drive API client
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({ version: 'v3', auth });

app.post('/', async (req, res) => {
  const { url, type } = req.body;

  if (!url || !type) {
    return res.status(400).send('URL and type are required.');
  }

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const fileContent = response.data;

    if (type === 'application/pdf') {
      const extractedText = await extractTextFromPDF(fileContent);

      if (!extractedText.trim()) {
        const pdfBuffer = await axios.get(url, { responseType: 'arraybuffer' });
        const imageBuffer = await pdfToImage(pdfBuffer.data);
        const fileId = await uploadImageToGoogleDrive(imageBuffer);
        const fileUrl = `https://drive.google.com/uc?id=${fileId}`;
        res.status(200).json({ file_url: fileUrl });
      } else {
        res.status(200).json({ extracted_text: extractedText });
      }
    } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const extractedText = await extractTextFromDocx(fileContent);
      res.status(200).json({ extracted_text: extractedText });
    } else {
      res.status(400).send('Unsupported file type');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

async function pdfToImage(pdfBuffer) {
  // Placeholder function for PDF to image conversion using a library like Sharp
  // Replace this with your actual PDF to image conversion logic
  // For example:
  // const sharp = require('sharp');
  // const imageBuffer = await sharp(pdfBuffer).png().toBuffer();
  // return imageBuffer;
}

async function extractTextFromPDF(fileContent) {
  const data = await pdfParse(fileContent);
  return data.text;
}

async function extractTextFromDocx(fileContent) {
  // Implement DOCX extraction logic as needed
  return 'Extracted text from DOCX';
}

async function uploadImageToGoogleDrive(imageBuffer) {
  const fileMetadata = {
    name: `${Date.now()}_output_image.png`,
    mimeType: 'image/png',
  };

  const media = {
    mimeType: 'image/png',
    body: stream.Readable.from(imageBuffer),
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });

  return response.data.id;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
