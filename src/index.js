#!/usr/bin/env node

var generate = require('./generate');
var generateSLAs = require('./generate-sla');  
var utils = require('./utils');
var runTest = require('./runTest');
var commander = require('commander');
var program = new commander.Command();

// CLI tool name and usage
program
    .name('sla-wizard')
    .usage('<arguments> <options>');

// 'config': main command
program.command('config')
    .addArgument(new commander.Argument('<proxy>', 'Proxy for which the configuration should be generated.').choices(['nginx', 'haproxy', 'traefik', 'envoy']))
    .requiredOption('-o, --outFile <configFile>', 'Config output file.')
    .option('--sla <slaPath>', 'One of: 1) single SLA, 2) folder of SLAs, 3) URL returning an array of SLA objects', './specs/sla.yaml')
    .option('--oas <pathToOAS>', 'Path to an OAS v3 file.', './specs/oas.yaml')
    .option('--customTemplate <customTemplate>', 'Custom proxy configuration template.')
    .option('--authLocation <authLocation>', 'Where to look for the authentication parameter. Must be one of: header, query, url.', 'header')
    .option('--authName <authName>', 'Name of the authentication parameter, such as "token" or "apikey".', 'apikey')
    .option('--proxyPort <proxyPort>', 'Port on which the proxy is running', 80)
    .action(function(proxy, options) {
        proxy,
        options = utils.validateParamsCLI(proxy, options);
        generate.generateConfigHandle(options.oas,
            proxy,
            options.sla,
            options.outFile,
            options.customTemplate,
            options.authLocation,
            options.authName,
            options.proxyPort);
    })


program.command('generate-slas')
    .description('Generates SLAs with valid apikeys using an SLA template and a CSV with the API clients')
    .requiredOption('--slaTemplate <slaTemplate>', 'Path to SLA template in YAML format following OAS4SLAs')
    .requiredOption('--csv <csvPath>', 'Path to CSV with client information. Must have an "email" column')
    .requiredOption('-o, --outDir <outDir>', 'Directory where the generated SLAs will be saved')
    .option('--numKeys <numKeys>', 'Number of apikeys that each client should have. Default is 1', 1)
    .option('--mappingFile <mappingFile>', 'Path where the apikeys mapping JSON will be saved. Defaults to <outDir>/apikeys_mapping.json')
    .option('--existingSLAs <existingSLAs>', 'Path to a folder containing existing SLAs to update')
    .action((options) => {
        generateSLAs.generateSLAsFromCSV(
            options.slaTemplate,
            options.csv,
            options.outDir,
            parseInt(options.numKeys, 10),
            options.mappingFile,
            options.existingSLAs
        );
    });

// 'runTest': test command
program.command('runTest')
    .description('Run test with APIPecker.')
    .option('--specs <testSpecs>', 'Path to a test config file.', './specs/testSpecs.yaml')
    .option('--sla <slaPath>', 'One of: 1) single SLA, 2) folder of SLAs, 3) URL returning an array of SLA objects', './specs/sla.yaml')
    .option('--oas <pathToOAS>', 'Path to an OAS v3 file.', './specs/oas.yaml')
    .action((options) => {
        runTest.runTest(options.oas,
            options.sla,
            options.specs);
    });

// Program parse
program
    .parse(process.argv);