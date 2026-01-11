const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const csv = require('csv-parser');
var configs = require("./configs");

/**
 * Generates an SLA file with secure API keys from a template, or updates an existing one.
 * @param {string} slaTemplatePath - Path to the SLA template in YAML format.
 * @param {string} email - Customer email used to personalize the SLA.
 * @param {string} outFile - Path where the generated SLA file will be saved.
 * @param {number} numKeys - Number of API keys to have.
 * @param {string} existingSLAPath - Optional path to an existing SLA file.
 * @returns {string[]} List of generated/existing API keys.
 */
function generateSLAWithKeys(slaTemplatePath, email, outFile, numKeys = 4, existingSLAPath = null) {
    try {
        let slaDoc;
        let existingKeys = [];

        if (existingSLAPath && fs.existsSync(existingSLAPath)) {
            const existingContent = fs.readFileSync(existingSLAPath, 'utf8');
            slaDoc = yaml.load(existingContent);
            existingKeys = slaDoc.context && slaDoc.context.apikeys ? slaDoc.context.apikeys : [];
            configs.logger.debug(`Found existing SLA for ${email} with ${existingKeys.length} keys.`);
        } else {
            const templateContent = fs.readFileSync(slaTemplatePath, 'utf8');
            slaDoc = yaml.load(templateContent);
            configs.logger.debug(`Generating new SLA for ${email}.`);
        }

        const apikeys = [...existingKeys];

        if (apikeys.length < numKeys) {
            const keysToGenerate = numKeys - apikeys.length;
            configs.logger.debug(`Generating ${keysToGenerate} new keys for ${email}.`);
            for (let i = 0; i < keysToGenerate; i++) {
                const apiKey = crypto
                    .createHash('sha256')
                    .update(email + Date.now() + crypto.randomBytes(16).toString('hex'))
                    .digest('hex')
                    .slice(0, 32);
                apikeys.push(apiKey);
            }
        } else if (apikeys.length > numKeys) {
            configs.logger.debug(`Removing ${apikeys.length - numKeys} keys for ${email}.`);
            apikeys.splice(numKeys);
        }

        if (!slaDoc.context) slaDoc.context = {};
        slaDoc.context.apikeys = apikeys;
        slaDoc.context.id = `sla-${email.replace(/[^a-zA-Z0-9]/g, '_')}`

        const newSLAContent = yaml.dump(slaDoc, { lineWidth: -1 });
        fs.writeFileSync(outFile, newSLAContent, 'utf8');

        configs.logger.debug(`SLA ${existingSLAPath ? 'updated' : 'generated'} for ${email}: ${outFile}`);  

        return apikeys;      
    } catch (err) {
        configs.logger.error(`Error processing SLA for ${email}: ${err.message}`);
        process.exit(1);
    }
}

/**
 * Generates multiple SLA files from a CSV file containing an "email" column.
 * Also creates a JSON mapping file with the generated API keys for each email.
 * @param {string} slaTemplatePath - Path to the SLA template in YAML format.
 * @param {string} csvPath - Path to the CSV file containing client information. Must include an "email" column.
 * @param {string} outDir - Directory where the generated SLA files will be saved.
 * @param {number} numKeys - Number of API keys to generate per client. Default is 4.
 * @param {string} mappingFilePath - Path to the mapping file.
 * @param {string} existingSLAsDir - Directory with existing SLAs to update.
 */
function generateSLAsFromCSV(slaTemplatePath, csvPath, outDir, numKeys = 4, mappingFilePath = null, existingSLAsDir = null) {
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const mapping = {}; // { email: [apikeys...] }

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            if (row.email) {
                const sanitizedEmail = row.email.replace(/[^a-zA-Z0-9]/g, '_');
                const outFile = path.join(outDir, `sla_${sanitizedEmail}.yaml`);
                
                let existingSLAPath = null;
                if (existingSLAsDir && fs.existsSync(existingSLAsDir)) {
                    const potentialPath = path.join(existingSLAsDir, `sla_${sanitizedEmail}.yaml`);
                    if (fs.existsSync(potentialPath)) {
                        existingSLAPath = potentialPath;
                    }
                }

                const apikeys = generateSLAWithKeys(slaTemplatePath, row.email, outFile, numKeys, existingSLAPath);

                mapping[row.email] = {
                    apikeys,
                    slaFile: outFile
                };
            } else {
                configs.logger.warn(`Row without "email" column: ${JSON.stringify(row)}`);
            }
        })
        .on('end', () => {
            const mappingFile = mappingFilePath || path.join(outDir, 'apikeys_mapping.json');
            fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf8');
            configs.logger.debug(`SLAs successfully processed in ${outDir}. Mapping at: ${mappingFile}`);
        });
}

module.exports = {
    generateSLAsFromCSV
};
