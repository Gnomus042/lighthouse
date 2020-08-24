/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const jsonld = require('jsonld');
const ParserJsonld = require('@rdfjs/parser-jsonld');
const toReadableStream = require('to-readable-stream');
const rdf = require('rdf-ext');
const shexValidator = require('./helpers/shexValidator.js');
const shaclValidator = require('./helpers/shaclValidator.js');
const context = require('./assets/context.json');
const { da } = require('../i18n/locales.js');

// TODO will need to remove these fields
const defaultId = 'http://example.org/recipe';
const supportedServices = [''];
const linkToShexShapes = 'https://gnomus042.com/shex/shapes';

/** @typedef {{property: string|null, severity: string, message: string, url: string|null, description: string|null, services: Array<string>|null}} StructuredDataReport */

/**
 * Adds context to data and sets dummy id for simplicity
 * @param {string} inputText JSON-LD object in string format
 * @returns {*}
 */
function prepareInput(inputText) {
  const data = JSON.parse(inputText);
  if (!data['@id']) {
    data['@id'] = defaultId;
  }
  data['@context'] = context;
  return JSON.stringify(data);
}

/**
 * Finds intersection between shex and shacl errors. Probably should be replaced.
 * @param {Array<StructuredDataReport>} shexReport
 * @param {Array<StructuredDataReport>} shaclReport
 */
function findIntersection(shexReport, shaclReport) {
  /** @param {StructuredDataReport} a @param {StructuredDataReport} b */
  const comparator = (a, b) => a.property === b.property && a.severity === b.severity;
  return shexReport.filter(a => shaclReport.some(b => comparator(a, b)));
}


function servicesToProperty(report) {
  const mapper = new Map();
  report.forEach(x => {
    if (mapper.has(x.property)) {
      mapper.get(x.property).push(...x.services);
    } else {
      mapper.set(x.property, x.services);
    }
  });
  return mapper;
}

function uniqueBy(items, key) {
  let seen = {};
  return items.filter(function (item) {
    const val = item[key];
    return seen.hasOwnProperty(val) ? false : (seen[val] = true);
  });
}

/**
 * @param {string} inputText JSON-LD object in expanded form
 * @return {Promise<Array<StructuredDataReport>>}
 */
async function validateSinglePiece(inputText) {
  const data = JSON.parse(inputText);
  const dataType = Array.isArray(data['@type'])?data['@type'][0]:data['@type'];
  const report = (await Promise.all(supportedServices.map(async service => {
    const shexErrors = await shexValidator.validate(inputText, linkToShexShapes, data['@id'], dataType, service);
    // const shaclErrors = await shaclValidator.validate(inputText);
    // const serviceReport = findIntersection(shexErrors, shaclErrors);
    shexErrors.forEach(x => {
      x.services = [service];
      x.shape = dataType;
    });
    return shexErrors;
  }))).flat();
  const propertyMap = servicesToProperty(report);
  const finalReport = uniqueBy(report, 'property');
  finalReport.forEach(x => x.services = propertyMap.get(x.property).join());
  return finalReport;
}

/**
 * @param {Array<string>} inputText JSON-LD object in expanded form
 * @return {Promise<Array<StructuredDataReport>>}
 */
module.exports = async function validateSchemaOrg(inputs) {
  inputs = inputs.map(input => {
    const data = JSON.parse(input);
    if (data['@graph']) return data['@graph'].map(JSON.stringify);
    return input;
  }).flat();
  const reports = await Promise.all(inputs.map(async inputText => {
    inputText = prepareInput(inputText);
    return await validateSinglePiece(inputText);
  }));
  return reports.flat();
};
