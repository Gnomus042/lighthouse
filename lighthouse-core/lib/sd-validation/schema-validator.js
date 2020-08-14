/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const shexValidator = require('./helpers/shexValidator.js');
const shaclValidator = require('./helpers/shaclValidator.js');
const context = require('./assets/context.json');

// TODO will need to remove these fields
const defaultId = 'http://example.org/recipe';
const supportedServices = ['Google', 'Bing', 'Pinterest', 'Yandex'];
const linkToShexShapes = 'https://gnomus042.com/shex/shapes';

/** @typedef {{property: string|null, severity: string, message: string, url: string|null, description: string|null, service: string|null}} StructuredDataReport */

/**
 * Adds context to data and sets dummy id for simplicity
 * @param {string} inputText JSON-LD object in string format
 * @returns {string}
 */
function prepareInput(inputText) {
  const data = JSON.parse(inputText);
  data['@id'] = defaultId;
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

/**
 * @param {string} inputText JSON-LD object in expanded form
 * @return {Promise<Array<StructuredDataReport>>}
 */
module.exports = async function validateSchemaOrg(inputText) {
  inputText = prepareInput(inputText);
  const report = await Promise.all(supportedServices.map(async service => {
    const shexErrors = await shexValidator.validate(inputText, linkToShexShapes, defaultId, 'Recipe', service);
    const shaclErrors = await shaclValidator.validate(inputText);
    const serviceReport = findIntersection(shexErrors, shaclErrors);
    serviceReport.forEach(x => x.service = service);
    return serviceReport;
  }));

  return report.flat();
};
