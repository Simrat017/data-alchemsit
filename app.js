const express = require('express');
const bodyParser = require('body-parser');
const json2csv = require('json2csv').parse;
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Endpoint to handle data conversion
app.post('/convert', (req, res) => {
  try {
    console.log('Received request:', req.body); // Log the entire req.body object
    const { data, fileType } = req.body;

    // Validate input
    if (!data || !fileType) {
      return res.status(400).json({ message: 'Data and fileType are required fields' });
    }

    // Validate fileType
    const supportedFileTypes = ['CSV', 'XLSX', 'PDF'];
    if (!supportedFileTypes.includes(fileType.toUpperCase())) {
      return res.status(400).json({ message: 'Unsupported fileType. Supported types: CSV, XLSX, PDF' });
    }

    // Convert data based on fileType
    switch (fileType.toUpperCase()) {
      case 'CSV':
        const flattenedCsvData = flattenJson(data);
        const csvData = json2csv(flattenedCsvData);
        res.header('Content-Type', 'text/csv');
        res.attachment('data.csv');
        return res.send(csvData);

      case 'XLSX':
        const flattenedXlsxData = flattenJson(data);
        const ws = XLSX.utils.json_to_sheet(flattenedXlsxData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.attachment('data.xlsx');
        return res.send(xlsxBuffer);

      case 'PDF':
        const doc = new PDFDocument();
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          let pdfData = Buffer.concat(buffers);
          res.header('Content-Type', 'application/pdf');
          res.attachment('data.pdf');
          return res.send(pdfData);
        });
        convertJsonToPdf(doc, data);
        doc.end();
        break;

      default:
        return res.status(400).json({ message: 'Unsupported fileType. Supported types: CSV, XLSX, PDF' });
    }
  } catch (err) {
    console.error('Error converting data:', err);
    res.status(500).json({ message: 'Error converting data' });
  }
});

// Function to convert JSON data to PDF content
function convertJsonToPdf(doc, data, indentLevel = 0) {
  const indent = ' '.repeat(indentLevel * 2);
  if (Array.isArray(data)) {
    data.forEach(item => {
      convertJsonToPdf(doc, item, indentLevel + 1);
      doc.moveDown();
    });
  } else if (typeof data === 'object' && data !== null) {
    Object.keys(data).forEach(key => {
      doc.text(`${indent}${key}:`);
      convertJsonToPdf(doc, data[key], indentLevel + 1);
    });
  } else {
    doc.text(`${indent}${data}`);
  }
}

// Function to flatten JSON structure
function flattenJson(data) {
  let result = [];
  if (Array.isArray(data)) {
    data.forEach(item => {
      let flatItem = {};
      flattenHelper(item, flatItem);
      result.push(flatItem);
    });
  } else {
    let flatItem = {};
    flattenHelper(data, flatItem);
    result.push(flatItem);
  }
  return result;
}

function flattenHelper(data, flatItem, prefix = '') {
  if (typeof data === 'object' && data !== null) {
    Object.keys(data).forEach(key => {
      flattenHelper(data[key], flatItem, prefix ? `${prefix}.${key}` : key);
    });
  } else {
    flatItem[prefix] = data;
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
