const { generateSLAsFromCSV } = require('../src/generate-sla');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { expect } = require('chai');

describe('Realistic SLA Generation Scenarios', function () {
    const baseDir = path.join(__dirname, 'sla-generation');
    const existingSLAsDir = path.join(baseDir, 'existing-slas');
    const slaTemplatesDir = path.join(baseDir, 'sla-templates');
    const csvDir = path.join(baseDir, 'csv');
    
    // Output directory
    const outputDir = path.join(__dirname, 'sla-generation-output');
    const mappingFilePath = path.join(outputDir, 'apikeys_mapping.json');

    const basicCSV = path.join(csvDir, 'usersBasic.csv');
    const premiumCSV = path.join(csvDir, 'usersPremium.csv');
    
    const basicTemplate = path.join(slaTemplatesDir, 'basicResearcher.yaml');
    const premiumTemplate = path.join(slaTemplatesDir, 'premiumResearcher.yaml');

    beforeEach(() => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
    });

    it('Scenario: Generate Basic and Premium SLAs, preserving existing ones', function (done) {
        this.timeout(10000);
        
        generateSLAsFromCSV(basicTemplate, basicCSV, outputDir, 1, mappingFilePath, existingSLAsDir);

        setTimeout(() => {
            try {
                const basicUser = 'newBasicUser@us.es';
                const existingBasicUser = 'dgalvan@us.es';
                
                const mapping = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                
                expect(mapping).to.have.property(basicUser);
                expect(fs.existsSync(mapping[basicUser].slaFile)).to.be.true;
                
                const originalDgalvanSLA = path.join(existingSLAsDir, 'sla_dgalvan_us_es.yaml');
                const originalDgalvanDoc = yaml.load(fs.readFileSync(originalDgalvanSLA, 'utf8'));
                const originalDgalvanKey = originalDgalvanDoc.context.apikeys[0];
                
                const updatedDgalvanDoc = yaml.load(fs.readFileSync(mapping[existingBasicUser].slaFile, 'utf8'));
                expect(updatedDgalvanDoc.context.apikeys[0]).to.equal(originalDgalvanKey);
                
                const premiumMappingFile = path.join(outputDir, 'premium_mapping.json');
                generateSLAsFromCSV(premiumTemplate, premiumCSV, outputDir, 1, premiumMappingFile, existingSLAsDir);
                
                setTimeout(() => {
                    try {
                        const premiumMapping = JSON.parse(fs.readFileSync(premiumMappingFile, 'utf8'));
                        
                        const mappingKeys = Object.keys(premiumMapping);
                        const foundPremiumUser = mappingKeys.find(k => k.trim() === 'newPremiumUser@us.es');
                        
                        expect(foundPremiumUser).to.not.be.undefined;
                        expect(fs.existsSync(premiumMapping[foundPremiumUser].slaFile)).to.be.true;

                        const existingPremiumUser = 'pablofm@us.es';
                        const originalPabloSLA = path.join(existingSLAsDir, 'sla_pablofm_us_es.yaml');
                        const originalPabloDoc = yaml.load(fs.readFileSync(originalPabloSLA, 'utf8'));
                        const originalPabloKey = originalPabloDoc.context.apikeys[0];
                        
                        const updatedPabloDoc = yaml.load(fs.readFileSync(premiumMapping[existingPremiumUser].slaFile, 'utf8'));
                        expect(updatedPabloDoc.context.apikeys[0]).to.equal(originalPabloKey);

                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 1000);

            } catch (err) {
                done(err);
            }
        }, 1000);
    });
});
