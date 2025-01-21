const express = require('express');
const fs = require('fs');
const path = require('path');

async function extractPDFContent(pdfBuffer) {
    const { getDocument } = await import('pdfjs-dist');
    const data = new Uint8Array(pdfBuffer);
    const pdfDoc = await getDocument({ data }).promise;
    const numPages = pdfDoc.numPages;
    const content = [];

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        // Extract text
        const textElements = textContent.items.map((item, index) => ({
            text: item.str,
            x: item.transform[4],
            y: (index === 0) ? viewport.height - item.transform[5] - 15 : viewport.height - item.transform[5],
            width: item.width,
            height: item.height,
        }));

        // Extract images (not directly supported by pdfjs, requires additional work)
        const images = []; // Placeholder for images

        content.push({
            pageNum: i,
            width: viewport.width,
            height: viewport.height,
            textElements,
            images,
        });
    }

    return content;
}

// Function to generate raw HTML from extracted content
function generateHTML(content) {
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                background: #f0f0f0;
                padding: 20px;
            }
            .page-container {
                margin: 0 auto;
                width: 794px;
                height: 1123px;
                background: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                position: relative;
                margin-bottom: 20px;
            }
            .page-boundary {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border: 1px dashed #ccc;
                pointer-events: none;
            }
            .page { 
                position: absolute;
                top: 0;
                left: 0;
                transform-origin: top left;
            }
            .text-element { position: absolute; white-space: nowrap; }
            .image-element { position: absolute; }
        </style>
    </head>
    <body>
    `;

    const scaleFactor = 96 / 72; // Convert points to pixels
    content.forEach(page => {
        const containerWidth = page.width * scaleFactor;
        const containerHeight = page.height * scaleFactor;

        htmlContent += `
        <div class="page-container" style="width:${containerWidth}px; height:${containerHeight}px;">
            <div class="page-boundary"></div>
            <div class="page" style="transform: scale(${scaleFactor}); width:${page.width}px; height:${page.height}px;">
        `;

        // Add text elements
        page.textElements.forEach(text => {
            htmlContent += `
            <div class="text-element" style="left: ${text.x}px; top: ${text.y}px; font-size: ${text.height}px;">
                ${text.text}
            </div>
            `;
        });

        htmlContent += `</div></div>`;
    });

    htmlContent += `</body></html>`;
    return htmlContent;
}

// Main function
async function convertPDFToHTML(pdfBuffer) {
    const content = await extractPDFContent(pdfBuffer);
    return generateHTML(content);
}

module.exports = { convertPDFToHTML };
