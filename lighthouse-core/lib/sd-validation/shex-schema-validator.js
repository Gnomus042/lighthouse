/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ShexValidator = require('./helpers/shexValidator.js').Validator;
const utils = require('./helpers/utils.js');
const parsers = require('./helpers/parser.js');

const namespace = require('rdflib').Namespace;
const rdf = namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const schema = namespace('http://schema.org/');
const shex = namespace('http://schema.org/shex#');


// hierarchy of services in the tree format, used for identifying validation
// order (e.g. Schema -> Google -> GoogleAds -> ...)
const hierarchy = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'hierarchy.json'))
  .toString());
/** @type {LH.StructuredData.ShExSchema} ShEx shapes in the ShExJ format */
const shapes = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'full.shexj')).toString());
const shapeIds = shapes.shapes.map(shape => shape.id);

// Annotations map, used in the current version of ShEx shapes
// [property name in the validation report ->
// URI of the property annotation, used in shapes]
const annotations = {
  url: schema('url').value,
  description: schema('description').value,
  severity: schema('identifier').value,
};
const shexValidator = new ShexValidator(shapes, {annotations: annotations});

/**
 * Recursive validation against all service nodes in the hierarchy
 * @param {LH.StructuredData.Hierarchy} hierarchyNode
 * @param {import('n3').Store} shapeStore
 * @param {*} id
 */
async function recursiveValidate(hierarchyNode, shapeStore, id) {
  const type = utils.removeUrls(shapeStore.getQuads(id, rdf('type'), undefined)[0].object.value);
  const startShape = shex(`Valid${hierarchyNode.service}${utils.removeUrls(type)}`).value;

  /** @type {Array<LH.StructuredData.Failure>} */
  let failures = [];
  // validate only if the corresponding shex shape exists
  if (shapeIds.includes(startShape)) {
    failures = (await shexValidator.validate(shapeStore, startShape, {baseUrl: id})).failures;
  }

  failures.forEach(failure => {
    failure.service = hierarchyNode.service;
    failure.node = utils.removeUrls(type);
  });
  const properties = new Set(failures.map(failure => failure.property));

  if (hierarchyNode.nested) {
    for (const nestedService of hierarchyNode.nested) {
      const nestedFailures = (await recursiveValidate(nestedService, shapeStore, id))
        .filter(x => !properties.has(x.property));
      if (nestedFailures.length > 0) failures.push(...nestedFailures);
    }
  }

  return failures;
}


/**
 * @param {Array<string>} data JSON-LD, Microdata and RDFa data in the string format
 * @param {string} url URL of the audited page, used as base for parsing
 * @return {Promise<Array<LH.StructuredData.Failure>>}
 */
module.exports = async function validateSchemaOrg(data, url) {
  /** @type {Array<LH.StructuredData.Failure>} */
  const report = [];
  for (const item of data) {
    const shapes = utils.quadsToShapes(await parsers.stringToQuads(item, url));
    for (const [id, shape] of shapes.entries()) {
      const failures = utils.uniqueBy((await recursiveValidate(hierarchy, shape, id)),
        ['property', 'shape', 'severity']);
      if (failures.length > 0) report.push(...failures);
    }
  }
  return report;
};
