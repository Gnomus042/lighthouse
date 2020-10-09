/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const namespace = require('rdflib').Namespace;
const schema = namespace('https://schema.org/');
const rdf = namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

const shaclShapes = fs.readFileSync(path.join(__dirname, 'assets', 'full.shacl')).toString();
const subclasses = fs.readFileSync(path.join(__dirname, 'assets', 'subclasses.ttl')).toString();
const annotations = {
  url: schema('url').value,
  description: schema('description').value,
  severity: schema('identifier').value,
};

const ShaclValidator = require('./helpers/ShaclValidator.js').Validator;
const shaclValidator = new ShaclValidator(shaclShapes,
  {subclasses: subclasses, annotations: annotations});

const utils = require('./helpers/utils.js');
const parsers = require('./helpers/parser.js');

/**
 * @param {Array<string>} data JSON-LD, Microdata and RDFa data in the string format
 * @param {string} url
 */
module.exports = async function validateSchemaOrg(data, url) {
  const report = [];
  for (const item of data) {
    const shapes = utils.quadsToShapes(await parsers.stringToQuads(item, url));
    for (const [id, shape] of shapes.entries()) {
      const type = utils.removeUrls(shape.getQuads(id, rdf('type'), undefined)[0]
        .object.value);
      const failures = (await shaclValidator.validate(shape, {baseUrl: id})).failures;
      for (const failure of report) {
        failure.node = type;
      }
      if (failures.length > 0) report.push(...failures);
    }
  }
  return report;
};
