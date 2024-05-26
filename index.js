const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const gm = require('gm').subClass({ imageMagick: true });

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Endpoint to handle POST requests
app.post('/', async (req, res) => {
    const { url, type } = req.body;

    if (!url || !type) {
        return res.status(400).send('URL and type are required.');
    }

    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });

        if (type === 'application/pdf') {
            const extractedText = await extractTextFromPDF(response.data);

            if (!extractedText.trim()) {
                const outputImageName = `output_image_${Date.now()}.png`;
                const outputImagePath = path.resolve(__dirname, outputImageName);
                pdfToImage(response.data, outputImagePath, (err) => {
                    if (err) {
                        return res.status(500).send('Error processing PDF to image.');
                    }
                    res.json({ image_path: outputImagePath });
                    deleteImageAfterDelay(outputImagePath, 1800);
                });
            } else {
                res.json({ extracted_text: extractedText });
            }
        } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(response.data);
            res.json({ extracted_text: extractedText });
        } else {
            res.status(400).send('Unsupported file type');
        }
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

function extractTextFromPDF(fileContent) {
    return pdfParse(fileContent).then(data => data.text);
}

function extractTextFromDocx(fileContent) {
    return mammoth.extractRawText({ buffer: fileContent }).then(result => result.value);
}

function pdfToImage(pdfBuffer, outputImagePath, callback) {
    const inputPath = path.resolve(__dirname, `input_${Date.now()}.pdf`);
    fs.writeFileSync(inputPath, pdfBuffer);

    gm(inputPath)
        .density(300)
        .write(outputImagePath, (err) => {
            fs.unlinkSync(inputPath); // Cleanup input PDF file
            callback(err);
        });
}

function deleteImageAfterDelay(filePath, delay) {
    setTimeout(() => {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }, delay * 1000);
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
