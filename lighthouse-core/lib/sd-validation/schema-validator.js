/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const shexValidator = require('./helpers/shexValidator.js');
const context = require('./assets/context.json');

const supportedServices = [''];

/**
 * Generates default id for shapes without id
 * @param {number} length
 */
function generateDefaultId(length) {
  let defaultId = 'http://example.org/';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    defaultId += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return defaultId;
}
/**
 * Adds context to data and sets dummy id for simplicity
 * @param {string} inputText JSON-LD object in string format
 * @returns {*}
 */
function prepareInput(inputText) {
  const data = JSON.parse(inputText);
  if (!data['@id']) {
    data['@id'] = generateDefaultId(10);
  }
  data['@context'] = context;
  return JSON.stringify(data);
}

/**
 * Maps each properties to services, for which this property causes failures.
 * @param {Array<StructuredDataReport>} report
 * @returns {Map<string, Array<string>>}
 */
function servicesToProperty(report) {
  const mapper = new Map();
  report.forEach(x => {
    if (mapper.has(x.property)) {
      mapper.get(x.property).push(...(x.services || []));
    } else {
      mapper.set(x.property, x.services);
    }
  });
  return mapper;
}

/**
 * Filter unique objects by key
 * @param {Array<*>} items
 * @param {string} key
 */
function uniqueBy(items, key) {
  /** @type {*} */
  const seen = {};
  return items.filter(/** @param {*} item */function(item) {
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
  const dataType = Array.isArray(data['@type']) ? data['@type'][0] : data['@type'];
  const report = (await Promise.all(supportedServices.map(async service => {
    const shexErrors = await shexValidator.validate(inputText, data['@id'], dataType, service);
    shexErrors.forEach(x => {
      x.services = [service];
      x.shape = dataType;
    });
    return shexErrors;
  }))).flat();
  const propertyMap = servicesToProperty(report);
  const finalReport = uniqueBy(report, 'property');
  finalReport.forEach(/** @param {StructuredDataReport} x */ x => x.services = propertyMap.get(x.property).join());
  return finalReport;
}

/**
 * @param {Array<string>} inputs JSON-LD object in expanded form
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

/** @typedef {{
  property: string|undefined;
  severity: string;
  message: string;
  url: string|undefined;
  description: string|undefined;
  services: Array<string>|string|undefined;
  shape: string;
}} StructuredDataReport */

