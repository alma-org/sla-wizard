const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const csv = require('csv-parser');
var configs = require("./configs");

/**
 * Generates an SLA file with secure API keys from a template.
 * @param {string} slaTemplatePath - Path to the SLA template in YAML format.
 * @param {string} email - Customer email used to personalize the SLA.
 * @param {string} outFile - Path where the generated SLA file will be saved.
 * @param {number} numKeys - Number of API keys to generate. Default is 4.
 */
function generateSLAWithKeys(slaTemplatePath, email, outFile, numKeys = 4) {
    try {
        // 1. Load template
        const templateContent = fs.readFileSync(slaTemplatePath, 'utf8');
        const slaDoc = yaml.load(templateContent);

        // 2. Generate secure API keys
        const apikeys = [];
        for (let i = 0; i < numKeys; i++) {
            const apiKey = crypto
                .createHash('sha256')
                .update(email + Date.now() + crypto.randomBytes(16).toString('hex'))
                .digest('hex')
                .slice(0, 32);
            apikeys.push(apiKey);
        }

        // 3. Replace "apikeys" section
        slaDoc.context.apikeys = apikeys;

        // 4. Save new SLA to file
        const newSLAContent = yaml.dump(slaDoc, { lineWidth: -1 });
        fs.writeFileSync(outFile, newSLAContent, 'utf8');

        configs.logger.debug(`✅ SLA generated for ${email}: ${outFile}`);        
    } catch (err) {
        configs.logger.error(`❌ Error generating SLA for ${email}: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Generates multiple SLA files from a CSV file containing an "email" column.
 * For each email in the CSV, a new SLA file is created with unique API keys.
 * @param {string} slaTemplatePath - Path to the SLA template in YAML format.
 * @param {string} csvPath - Path to the CSV file containing client information. Must include an "email" column.
 * @param {string} outDir - Directory where the generated SLA files will be saved.
 * @param {number} numKeys - Number of API keys to generate per client. Default is 4.
 */
function generateSLAsFromCSV(slaTemplatePath, csvPath, outDir, numKeys = 4) {
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            if (row.email) {
                const sanitizedEmail = row.email.replace(/[^a-zA-Z0-9]/g, '_');
                const outFile = path.join(outDir, `sla_${sanitizedEmail}.yaml`);
                generateSLAWithKeys(slaTemplatePath, row.email, outFile, numKeys);
            } else {
                console.warn(`⚠️ Row without "email" column: ${JSON.stringify(row)}`);
            }
        })
        .on('end', () => {
            console.log(`SLAs successfully generated in: ${outDir}`);
        });
}

module.exports = {
    generateSLAsFromCSV
};
