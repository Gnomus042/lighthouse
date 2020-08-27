'use strict';

const i18n = require('../../../lib/i18n/i18n.js');
const MessageStrings = {
  TypeMismatch: `Value provided for property {property} has a wrong type`,
  MissingProperty: `Property {property} not found`,
  ExcessTripleViolation: `Property {property} has a cardinality issue`,
  BooleanSemActFailure: `Property {property} failed semantic action with code js:'{code}'`,
};

const str_ = i18n.createMessageInstanceIdFn(__filename, MessageStrings);

// TODO register shex and n3 modules
const shex = require('../libs/shex.js');
const jsonld = require('jsonld');
const n3 = require('n3');

const fs = require('fs');
const path = require('path');
const shexShapes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'full.shexj'));

const TYPE_PROPERTY = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

class ValidationReport {
  /**
   * @param {ShExNestedReport} jsonReport shex.js nested report
   * @param {*} schema shex shapes
   */
  constructor(jsonReport, schema) {
    /** @type {Array<ShExStructuredDataReport>} */
    this.failures = [];
    /** @type {Map<string, *>} */
    this.shapes = new Map();
    schema.shapes.forEach(shape => {
      this.shapes.set(shape.id, this.shapeFromSchema(shape));
    });
    this.simplify(jsonReport, undefined, undefined);
    this.annotationProperties = {
      URL: 'http://schema.org/url',
      DESCRIPTION: 'http://schema.org/description',
      IDENTIFIER: 'http://schema.org/identifier',
    };
  }

  /**
   * Recoursive function that simplifies complex nested shex.js report
   * @param {*} jsonReport shex.js validation report
   * @param {string|undefined} parentNode data node where the error has occurred
   * @param {string|undefined} parentShape shex shape which has a failing constraint
   */
  simplify(jsonReport, parentNode, parentShape) {
    // STEP 1: if report doesn't contain errors or MissingProperty type, return
    if (jsonReport.type === 'ShapeAndResults' ||
      jsonReport.property === TYPE_PROPERTY ||
      jsonReport.constraint && jsonReport.constraint.predicate === TYPE_PROPERTY ||
      jsonReport.type === 'ShapeOrResults') {
      return;
    }

    // STEP 2: if array or intermediate nested structure, simplify nested values
    if (Array.isArray(jsonReport)) {
      jsonReport.forEach(err => this.simplify(err, parentNode, parentShape));
      return;
    }
    if (jsonReport.type === 'ShapeAndFailure' ||
      jsonReport.type === 'Failure' ||
      jsonReport.type === 'SemActFailure') {
      const node = typeof jsonReport.node === 'object' ? null : jsonReport.node;
      jsonReport.errors
        .forEach(/** @param {*} err */ err => this.simplify(err, node, jsonReport.shape));
      return;
    }
    // STEP 3: collect errors
    const failure = {
      type: jsonReport.type,
      property: jsonReport.property || (jsonReport.constraint && jsonReport.constraint.predicate),
      message: '',
      node: (jsonReport.triple && jsonReport.triple.subject) || parentNode,
      shape: parentShape,
    };
    if (jsonReport.type === 'TypeMismatch') {
      failure.message = str_(MessageStrings.TypeMismatch, {property: failure.property});
      jsonReport.errors
        .forEach(/** @param {*} err */ err => this.simplify(err, undefined, undefined));
    } else if (jsonReport.type === 'MissingProperty') {
      if (!parentNode) return;
      failure.message = str_(MessageStrings.MissingProperty, {property: failure.property});
    } else if (jsonReport.type === 'ExcessTripleViolation') {
      if (!parentNode) return;
      failure.message = str_(MessageStrings.ExcessTripleViolation, {property: failure.type});
    } else if (jsonReport.type === 'BooleanSemActFailure') {
      if (!jsonReport.ctx.predicate) return;
      failure.message = str_(MessageStrings.BooleanSemActFailure,
        {property: failure.property, code: jsonReport.code});
    } else if (jsonReport.type === 'NodeConstraintViolation' ||
      jsonReport.type === 'ShapeOrFailure' ||
      jsonReport.type === 'ClosedShapeViolation') {
      // TODO find out what should be here.
      return;
    } else {
      failure.type = jsonReport.type;
      failure.message = `Unknown type ${jsonReport.type}`;
    }
    this.failures.push(failure);
  }

  /**
   * Recursively parse shape object from shex shapes nested structure
   * @param {*} struct current structure to parse
   * @returns {any|undefined}
   */
  shapeFromSchema(struct) {
    if (struct.type === 'Shape') {
      return struct;
    }
    if (struct.shapeExprs) {
      return struct.shapeExprs
        .map(/** @param {*} nestedStruct */ nestedStruct => this.shapeFromSchema(nestedStruct))
        .filter(/** @param {*} nestedStruct */ nestedStruct => nestedStruct !== undefined);
    }
  }

  /**
   * Get annotations map
   * @param {string} shape
   * @param {string} property
   * @returns {Map<string, string>}
   */
  getAnnotations(shape, property) {
    const mapper = new Map();
    if (!this.shapes.get(shape)) return mapper;
    let prop = this.shapes.get(shape)[0];
    if (!prop) return mapper;
    prop = prop.expression.expressions
      .filter(/** @param {{predicate: string}} x */ x => x.predicate === property)[0];
    if (!prop || !prop.annotations) return mapper;
    prop.annotations.forEach(/** @param {{predicate: string, object:{value: string}}} x*/ x => {
      mapper.set(x.predicate, x.object.value);
    });
    return mapper;
  }

  /**
   * Reformat ShEx report to structured data report
   * @returns {Array<StructuredDataReport>}
   */
  toStructuredDataReport() {
    /** @type {Array<StructuredDataReport>}  */
    const simplified = [];
    this.failures.forEach(err => {
      let annotations = new Map();
      if (err.shape && err.property) {
        annotations = this.getAnnotations(err.shape, err.property);
      }
      simplified.push({
        property: err.property,
        message: err.message,
        url: annotations.get(this.annotationProperties.URL),
        description: annotations.get(this.annotationProperties.DESCRIPTION),
        severity: annotations.get(this.annotationProperties.IDENTIFIER) || 'error',
        services: [],
        shape: '',
      });
    });
    return simplified;
  }
}

/**
 * Parse and prepare jsonld data to validation
 * @param {string} text
 */
async function parseJSONLD(text) {
  const nquads = await jsonld.toRDF(JSON.parse(text), {format: 'application/n-quads'});
  const turtleParser = new n3.Parser({
    format: 'text/turtle',
    baseIRI: JSON.parse(text)['@id'],
  });
  const store = new n3.Store();
  turtleParser.parse(nquads).forEach(quad => store.addQuad(quad));
  return store;
}

/**
 * Main function for ShEx validation
 * @param {string} dataStr
 * @param {string} dataId
 * @param {string} shape
 * @param {string} service
 * @returns {Promise<Array<StructuredDataReport>>}
 */
async function validateShEx(dataStr, dataId, shape, service) {
  const store = await parseJSONLD(dataStr);
  const shapes = shexShapes.toString();
  const schema = JSON.parse(shapes);
  const db = shex.Util.makeN3DB(store);
  const validator = shex.Validator.construct(schema);
  const errors = new ValidationReport(validator.validate(db, [{
    node: dataId,
    shape: `http://schema.org/shex#${service}${shape}`,
  }]), schema);
  return errors.toStructuredDataReport();
}

module.exports = {validate: validateShEx};

/** @typedef {import('../schema-validator.js').StructuredDataReport} StructuredDataReport */

/** @typedef {*} ShExNestedReport */

/** @typedef {{
  property: string|undefined;
  message: string;
  node: string|undefined;
  shape: string|undefined;
}} ShExStructuredDataReport */
