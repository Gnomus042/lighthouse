'use strict';

// TODO register shex and n3 modules
const shex = require('../libs/shex.js');
const jsonld = require('jsonld');
const n3 = require('n3');

const fs = require('fs');
const path = require('path');
const shexShapes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'full.shexj'));


const schemaType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/** @typedef {{property: string|null, message: string, node: string|null, shape: string|null, annotations: *}} ShExStructuredDataReport */

class ValidationReport {
  /**
   * @param {*} jsonReport
   * @param {*} schema
   */
  constructor(jsonReport, schema) {
    this.reportTypes = {
      ShapeAndResults: 'ShapeAndResults',
      ShapeOrResults: 'ShapeOrResults',
      ShapeAndFailure: 'ShapeAndFailure',
      Failure: 'Failure',
      SemActFailure: 'SemActFailure',
      TypeMismatch: 'TypeMismatch',
      MissingProperty: 'MissingProperty',
      ExcessTripleViolation: 'ExcessTripleViolation',
      BooleanSemActFailure: 'BooleanSemActFailure',
      NodeConstraintViolation: 'NodeConstraintViolation',
      ShapeOrFailure: 'ShapeOrFailure',
      ClosedShapeViolation: 'ClosedShapeViolation',
    };
    /** @type {Array<ShExStructuredDataReport>} */
    this.failures = [];
    /** @type {Map<string, *>} */
    this.shapes = new Map();
    this.parseSchema(schema);
    this.simplify(jsonReport, null, null);
    this.addAnnotations();
  }

  /**
   * Recoursive function that simplifies complex nested shex report
   * @param {*} jsonReport shex.js report
   * @param {string|null} parentNode data node where the error has occurred
   * @param {string|null} parentShape shex shape which has a failing constraint
   */
  simplify(jsonReport, parentNode, parentShape) {
    // STEP 1: if report doesn't contain errors or MissingProperty type, return
    if (jsonReport.type === this.reportTypes.ShapeAndResults ||
      jsonReport.property === schemaType ||
      jsonReport.constraint && jsonReport.constraint.predicate === schemaType ||
      jsonReport.type === this.reportTypes.ShapeOrResults) {
      return;
    }

    // STEP 2: if array or intermediate nested structure, simplify nested values
    if (Array.isArray(jsonReport)) {
      jsonReport.forEach(err => this.simplify(err, parentNode, parentShape));
      return;
    }
    if (jsonReport.type === this.reportTypes.ShapeAndFailure ||
      jsonReport.type === this.reportTypes.Failure ||
      jsonReport.type === this.reportTypes.SemActFailure) {
      const node = typeof jsonReport.node === 'object' ? null : jsonReport.node;
      jsonReport.errors.forEach(err => this.simplify(err, node, jsonReport.shape));
      return;
    }
    // STEP 3: collect errors
    const failure = {
      type: jsonReport.type,
      property: '',
      message: '',
      node: parentNode,
      shape: parentShape,
    };
    if (jsonReport.type === this.reportTypes.TypeMismatch) {
      if (jsonReport.triple.subject) failure.node = jsonReport.triple.subject;
      failure.property = jsonReport.constraint.predicate;
      failure.message =
        `Value provided for property ${jsonReport.constraint.predicate} has a wrong type`;
      jsonReport.errors.forEach(err => this.simplify(err, null, null));
    } else if (jsonReport.type === this.reportTypes.MissingProperty) {
      if (!parentNode) return;
      failure.property = jsonReport.property;
      failure.message = `Property ${jsonReport.property} not found`;
    } else if (jsonReport.type === this.reportTypes.ExcessTripleViolation) {
      if (!parentNode) return;
      failure.property = jsonReport.constraint.predicate;
      failure.message = `Property ${jsonReport.constraint.predicate} has a cardinality issue`;
    } else if (jsonReport.type === this.reportTypes.BooleanSemActFailure) {
      if (!jsonReport.ctx.predicate) return;
      failure.property = jsonReport.ctx.predicate;
      failure.message =
        `Property ${jsonReport.ctx.predicate} failed semantic action with code js:'${jsonReport.code}'`;
    } else if (jsonReport.type === this.reportTypes.NodeConstraintViolation ||
      jsonReport.type === this.reportTypes.ShapeOrFailure ||
      jsonReport.type === this.reportTypes.ClosedShapeViolation) {
      // TODO find out what should be here.
      return;
    } else {
      failure.type = jsonReport.type;
      failure.message = `Unknown type ${jsonReport.type}`;
    }
    this.failures.push(failure);
  }

  /**
   * Parse schema structure to map
   * @param {*} schema
   */
  parseSchema(schema) {
    /** @param {*} s */
    const getShape = s => {
      if (s.type === 'Shape') {
        return s;
      }
      if (s.shapeExprs) {
        return s.shapeExprs.map(x => getShape(x)).filter(x => x !== null && x !== undefined)[0];
      }
    };
    Object.keys(schema.shapes).forEach(shKey => {
      this.shapes.set(shKey, getShape(schema.shapes[shKey]));
    });
  }

  /**
   * Get annotations map
   * @param {string} shape
   * @param {string} property
   */
  _getAnnotations(shape, property) {
    if (!this.shapes.get(shape)) return;
    let properties = this.shapes.get(shape).expression.expressions;
    properties = properties.filter(x => x.predicate === property)[0];
    if (!properties || !properties.annotations) return;
    const annotations = {};
    properties.annotations.forEach(x => annotations[x.predicate] = x.object.value);
    return annotations;
  }

  /**
   * Adds annotations to generated report
   */
  addAnnotations() {
    this.failures.forEach(err => {
      err.annotations = this._getAnnotations(err.shape, err.property);
    });
  }

  /**
   * Reformat ShEx report to structured data report
   */
  toStructuredDataReport() {
    /** @type {Array<import('../schema-validator').StructuredDataReport>}  */
    const simplified = [];
    this.failures.forEach(err => {
      simplified.push({
        service: '',
        property: err.property,
        message: err.message,
        url: err.annotations ? err.annotations['http://schema.org/url'] : undefined,
        description: err.annotations ? err.annotations['http://schema.org/description'] : undefined,
        severity: err.annotations && err.annotations['http://schema.org/identifier'] ? err.annotations['http://schema.org/identifier'] : 'error',
      });
    });
    const uniq = [...new Set(simplified.map(JSON.stringify))];
    return uniq.map(JSON.parse);
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
 * @param {string} shexURL
 * @param {string} dataId
 * @param {string} shape
 * @param {string} service
 */
async function validateShEx(dataStr, shexURL, dataId, shape, service) {
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
