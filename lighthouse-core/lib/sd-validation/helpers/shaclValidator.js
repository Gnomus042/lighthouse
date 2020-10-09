'use strict';

const SHACLValidator = require('rdf-validate-shacl');

const utils = require('./utils.js');
const parser = require('./parser.js');

/**
 * Adds shacl base prefix to value
 * @param {string} value
 * @return {string}
 */
function shacl(value) {
  return 'http://www.w3.org/ns/shacl#' + value;
}

class ShaclValidator {
  /**
   * @param {string} shaclSchema - shacl shapes in string format
   * @param {{
   *     annotations?: object | undefined,
   *     subclasses?: string | undefined
   * }} options
   */
  constructor(shaclSchema, options = {}) {
    if (options.subclasses) {
      this.subclasses = parser.parseTurtle(options.subclasses, utils.dummyUrl());
    }
    this.shapes = parser.parseTurtle(shaclSchema, utils.dummyUrl());
    this.annotations = options.annotations || {};
    this.validator = new SHACLValidator(this.shapes.getQuads());
  }

  /**
   * Transforms SHACL severity to string
   * @param {string} val
   * @returns {string}
   */
  getSeverity(val) {
    switch (val) {
      case shacl('Info'):
        return 'info';
      case shacl('Warning'):
        return 'warning';
      default:
        return 'error';
    }
  }

  /**
   * Gets schema: annotations for some predicate
   * @param {string} property - property, which should have an annotation
   * @param {string} annotation - annotation predicate
   * @returns {string|undefined}
   */
  getAnnotation(property, annotation) {
    const quads = this.shapes.getQuads(property, annotation, undefined);
    if (quads.length > 0) return quads[0].object.value;
  }

  /**
   * Transform standard shacl failure to structured data failure
   * @param {*} shaclFailure
   * @returns {LH.StructuredData.Failure}
   */
  toStructuredDataFailure(shaclFailure) {
    // finds a source shape if property is failing
    let sourceShape = this.shapes.getQuads(undefined, shacl('property'),
      shaclFailure.sourceShape)[0];
    // if the whole shape is failing then leave sourceShape
    if (!sourceShape) sourceShape = shaclFailure.sourceShape;
    else sourceShape = sourceShape.subject;
    /** @type {LH.StructuredData.Failure} */
    const failure = {
      property: shaclFailure.path ? shaclFailure.path.value : undefined,
      message: shaclFailure.message.length > 0 ?
        shaclFailure.message.map(/** @param {*} x */ x => x.value).join('. ') : undefined,
      shape: sourceShape.id,
      severity: this.getSeverity(shaclFailure.severity.value),
      node: '',
    };
    for (const [key, value] of Object.entries(this.annotations)) {
      const annotation = this.getAnnotation(shaclFailure.sourceShape, value);
      if (annotation) failure[key] = annotation;
    }
    return failure;
  }

  /**
   * @param {string|LH.StructuredData.Store} data
   * @param {{baseUrl?: string}} options
   * @returns {Promise<LH.StructuredData.Report>}
   */
  async validate(data, options = {}) {
    const baseUrl = options.baseUrl || utils.dummyUrl();
    let quads;
    if (typeof data === 'string') {
      quads = await parser.stringToQuads(data, baseUrl);
    } else quads = data;
    let report;
    if (this.subclasses) {
      const quadsWithSubclasses = quads.getQuads();
      quadsWithSubclasses.push(...this.subclasses.getQuads());
      report = this.validator.validate(quadsWithSubclasses).results
        .map(x => this.toStructuredDataFailure(x));
    } else {
      report = this.validator.validate(quads.getQuads()).results
        .map(x => this.toStructuredDataFailure(x));
    }
    return {
      baseUrl: baseUrl,
      store: quads,
      failures: report,
    };
  }
}

module.exports = {Validator: ShaclValidator};
