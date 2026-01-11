const { generateSLAsFromCSV } = require('../src/generate-sla');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { expect } = require('chai');

describe('Exhaustive Testing for generate-slas', function () {
    const testDir = path.join(__dirname, 'exhaustive_test_slas');
    const csvPath = path.join(__dirname, 'test_clients_exhaustive.csv');
    const slaTemplatePath = path.join(__dirname, 'test_sla_template_exhaustive.yaml');
    const mappingFilePath = path.join(testDir, 'custom_mapping.json');

    beforeEach(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        fs.writeFileSync(slaTemplatePath, yaml.dump({
            context: {
                project: 'test-project',
                sla: 'test-sla'
            }
        }));
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        if (fs.existsSync(csvPath)) {
            fs.unlinkSync(csvPath);
        }
        if (fs.existsSync(slaTemplatePath)) {
            fs.unlinkSync(slaTemplatePath);
        }
    });

    it('Scenario 1: Fresh Generation - Should create SLAs and mapping for new users', function (done) {
        fs.writeFileSync(csvPath, 'email\nuser1@example.com\nuser2@example.com');
        
        generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 2, mappingFilePath);

        setTimeout(() => {
            try {
                expect(fs.existsSync(mappingFilePath)).to.be.true;
                const mapping = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                
                expect(mapping).to.have.property('user1@example.com');
                expect(mapping).to.have.property('user2@example.com');
                expect(mapping['user1@example.com'].apikeys).to.have.lengthOf(2);
                
                const slaFile = mapping['user1@example.com'].slaFile;
                expect(fs.existsSync(slaFile)).to.be.true;
                
                const slaDoc = yaml.load(fs.readFileSync(slaFile, 'utf8'));
                expect(slaDoc.context.apikeys).to.have.lengthOf(2);
                expect(slaDoc.context.id).to.equal('sla-user1_example_com');
                
                done();
            } catch (err) {
                done(err);
            }
        }, 500);
    });

    it('Scenario 2: Update with More Keys - Should preserve existing keys', function (done) {
        fs.writeFileSync(csvPath, 'email\nuser1@example.com');
        
        generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 1, mappingFilePath);

        setTimeout(() => {
            const mapping1 = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
            const originalKey = mapping1['user1@example.com'].apikeys[0];

            generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 3, mappingFilePath, testDir);

            setTimeout(() => {
                try {
                    const mapping2 = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                    expect(mapping2['user1@example.com'].apikeys).to.have.lengthOf(3);
                    expect(mapping2['user1@example.com'].apikeys[0]).to.equal(originalKey);
                    done();
                } catch (err) {
                    done(err);
                }
            }, 500);
        }, 500);
    }, 10000);

    it('Scenario 3: Update with Fewer Keys - Should truncate extra keys', function (done) {
        fs.writeFileSync(csvPath, 'email\nuser1@example.com');
        
        generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 3, mappingFilePath);

        setTimeout(() => {
            const mapping1 = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
            const originalKey = mapping1['user1@example.com'].apikeys[0];

            generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 1, mappingFilePath, testDir);

            setTimeout(() => {
                try {
                    const mapping2 = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                    expect(mapping2['user1@example.com'].apikeys).to.have.lengthOf(1);
                    expect(mapping2['user1@example.com'].apikeys[0]).to.equal(originalKey);
                    done();
                } catch (err) {
                    done(err);
                }
            }, 500);
        }, 500);
    }, 10000);

    it('Scenario 4: Mixed Case - Should update existing and generate new', function (done) {
        fs.writeFileSync(csvPath, 'email\nuser1@example.com');
        generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 1, mappingFilePath);

        setTimeout(() => {
            const mapping1 = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
            const user1Key = mapping1['user1@example.com'].apikeys[0];

            fs.writeFileSync(csvPath, 'email\nuser1@example.com\nuser2@example.com');
            generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 1, mappingFilePath, testDir);

            setTimeout(() => {
                try {
                    const mapping2 = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                    expect(mapping2['user1@example.com'].apikeys[0]).to.equal(user1Key);
                    expect(mapping2).to.have.property('user2@example.com');
                    expect(mapping2['user2@example.com'].apikeys).to.have.lengthOf(1);
                    done();
                } catch (err) {
                    done(err);
                }
            }, 500);
        }, 500);
    }, 10000);

    it('Scenario 5: Special Characters - Should sanitize email for file names and IDs', function (done) {
        const specialEmail = 'user+test@example.com';
        fs.writeFileSync(csvPath, `email\n${specialEmail}`);
        
        generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 1, mappingFilePath);

        setTimeout(() => {
            try {
                const mapping = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                expect(mapping).to.have.property(specialEmail);
                
                const expectedFileName = 'sla_user_test_example_com.yaml';
                expect(path.basename(mapping[specialEmail].slaFile)).to.equal(expectedFileName);
                
                const slaDoc = yaml.load(fs.readFileSync(mapping[specialEmail].slaFile, 'utf8'));
                expect(slaDoc.context.id).to.equal('sla-user_test_example_com');
                done();
            } catch (err) {
                done(err);
            }
        }, 500);
    });

    it('Scenario 6: Missing Email Column - Should log warning and skip row (tested via coverage/no-crash)', function (done) {
        fs.writeFileSync(csvPath, 'not_email\nvalue');
        
        generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 1, mappingFilePath);

        setTimeout(() => {
            try {
                const mapping = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                expect(Object.keys(mapping)).to.have.lengthOf(0);
                done();
            } catch (err) {
                done(err);
            }
        }, 500);
    });

    it('Scenario 7: Existing SLA with missing context/apikeys - Should handle gracefully', function (done) {
        const email = 'user1@example.com';
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        const slaFile = path.join(testDir, `sla_${sanitizedEmail}.yaml`);
        
        // Create an invalid existing SLA
        fs.writeFileSync(slaFile, yaml.dump({ something: 'else' }));
        
        fs.writeFileSync(csvPath, `email\n${email}`);
        generateSLAsFromCSV(slaTemplatePath, csvPath, testDir, 2, mappingFilePath, testDir);

        setTimeout(() => {
            try {
                const mapping = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
                expect(mapping[email].apikeys).to.have.lengthOf(2);
                
                const slaDoc = yaml.load(fs.readFileSync(slaFile, 'utf8'));
                expect(slaDoc.context.apikeys).to.have.lengthOf(2);
                done();
            } catch (err) {
                done(err);
            }
        }, 500);
    });
});
