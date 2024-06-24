const express = require('express');
const bodyParser = require('body-parser');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const upload = multer();
const app = express();

app.use(bodyParser.json()); // Middleware to parse JSON bodies

const PORT = process.env.PORT || 3000;

// Utility function to flatten JSON objects
const flattenObject = (obj, parent = '', res = {}) => {
    for (let key in obj) {
        let propName = parent ? `${parent}.${key}` : key;
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            flattenObject(obj[key], propName, res);
        } else if (Array.isArray(obj[key])) {
            obj[key].forEach((item, index) => {
                if (typeof item === 'object') {
                    flattenObject(item, `${propName}[${index}]`, res);
                } else {
                    res[`${propName}[${index}]`] = item;
                }
            });
        } else {
            res[propName] = obj[key];
        }
    }
    return res;
};

// Utility function to format flattened data for PDF
const formatForPDF = (data) => {
    let formatted = '';
    for (let key in data) {
        formatted += `${key}: ${data[key]}\n`;
    }
    return formatted;
};

// Data Input and Validation
app.post('/convert', upload.none(), (req, res) => {
    console.log('Request Body:', JSON.stringify(req.body, null, 2)); // Log the request body for debugging
    const { data, outputType } = req.body;

    if (!data || !outputType) {
        return res.status(400).json({ error: 'Data and outputType are required.' });
    }

    let processedData;
    if (Array.isArray(data)) {
        processedData = data.map(item => flattenObject(item));
    } else if (typeof data === 'object') {
        processedData = [flattenObject(data)];
    } else {
        return res.status(400).json({ error: 'Data must be a JSON object or an array of objects.' });
    }

    let convertedFile;
    let contentType;
    let fileExtension;

    console.log('Processed Data:', JSON.stringify(processedData, null, 2)); // Log the processed data for debugging

    try {
        switch (outputType.toLowerCase()) {
            case 'csv':
                const json2csvParser = new Parser();
                convertedFile = json2csvParser.parse(processedData);
                contentType = 'text/csv';
                fileExtension = 'csv';
                break;

            case 'excel':
                const workbook = XLSX.utils.book_new();
                const worksheet = XLSX.utils.json_to_sheet(processedData);
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
                convertedFile = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                fileExtension = 'xlsx';
                break;

            case 'pdf':
                const doc = new PDFDocument();
                const pdfBuffer = [];
                doc.on('data', chunk => pdfBuffer.push(chunk));
                doc.on('end', () => {
                    convertedFile = Buffer.concat(pdfBuffer);
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Disposition', `attachment; filename=data.${fileExtension}`);
                    res.send(convertedFile);
                });

                processedData.forEach((item, index) => {
                    const formattedItem = formatForPDF(item);
                    doc.text(formattedItem);
                    doc.moveDown(); // Add spacing between different items
                    if (index < processedData.length - 1) {
                        doc.addPage();
                    }
                });
                doc.end();
                contentType = 'application/pdf';
                fileExtension = 'pdf';
                return;  // Since PDF generation is asynchronous, we return here to prevent further response handling.

            default:
                console.log('Unsupported output type:', outputType); // Log unsupported type for debugging
                return res.status(400).json({ error: 'Unsupported output type.' });
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename=data.${fileExtension}`);
        res.send(convertedFile);
    } catch (error) {
        console.error('Error converting data:', error);
        res.status(500).json({ error: 'Failed to convert data.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
