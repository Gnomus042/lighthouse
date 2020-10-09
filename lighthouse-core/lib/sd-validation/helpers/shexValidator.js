'use strict';

const shex = require('../libs/shex.js');
const utils = require('./utils.js');
const errors = require('./errors.js');
const parser = require('./parser.js');

const namespace = require('rdflib').Namespace;
const rdf = namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

class ValidationReport {
  /**
   * @param {LH.StructuredData.ShExReport} jsonReport - report from shex.js, which needs to be simplified
   * @param {LH.StructuredData.ShExSchema} schema - parsed shapes in ShExJ format
   * @param {*} annotations
   */
  constructor(jsonReport, schema, annotations) {
    /** @type {Array<LH.StructuredData.Failure>} */
    this.failures = [];
    /** @type {Map<string,LH.StructuredData.ShExTargetShape>} */
    this.shapes = new Map();
    schema.shapes.forEach(shape => {
      const targetShape = this.getShapeCore(shape);
      if (targetShape) this.shapes.set(shape.id, targetShape);
    });
    this.simplify(jsonReport, undefined, undefined);
    this.annotations = annotations;
  }

  /**
   * Simplifies shex.js nested report into a linear structure
   * @param {LH.StructuredData.ShExReport} jsonReport
   * @param {string|undefined} parentNode
   * @param {string|undefined} parentShape
   */
  simplify(jsonReport, parentNode, parentShape) {
    if (Array.isArray(jsonReport)) {
      jsonReport.forEach(err => this.simplify(err, parentNode, parentShape));
      return;
    }
    // STEP 1: if report doesn't contain errors, MissingProperty @type or failures
    // that doesn't need to be added, return
    if (!jsonReport.type ||
      jsonReport.type === 'ShapeAndResults' ||
      jsonReport.type === 'ShapeOrResults' ||
      jsonReport.property === rdf('type').value ||
      jsonReport.constraint && jsonReport.constraint.predicate === rdf('type').value ||
      jsonReport.type === 'NodeConstraintViolation' ||
      jsonReport.type === 'ShapeOrFailure' ||
      jsonReport.type === 'ShapeTest') {
      return;
    }

    // STEP 2: if array or intermediate nested structure, simplify nested values
    if (jsonReport.type === 'ShapeAndFailure' ||
      jsonReport.type === 'Failure' ||
      jsonReport.type === 'SemActFailure' ||
      jsonReport.type === 'FailureList' ||
      jsonReport.type === 'ExtendedResults' ||
      jsonReport.type === 'ExtensionFailure' ||
      (!jsonReport.type) && jsonReport.errors) {
      const node = jsonReport.node;
      this.simplify(jsonReport.errors, node || parentNode, jsonReport.shape || parentShape);
      return;
    }
    // STEP 3: handle closed shape errors
    if (jsonReport.type === 'ClosedShapeViolation' && jsonReport.unexpectedTriples) {
      jsonReport.unexpectedTriples.forEach(trpl => {
        const failure = {
          type: jsonReport.type,
          property: trpl.predicate,
          message: `Unexpected property ${trpl.predicate}`,
          node: parentNode || '',
          shape: parentShape,
          severity: 'error',
        };
        this.failures.push(failure);
      });
      return;
    }
    // STEP 4: fill out the failure
    const failure = {
      type: jsonReport.type,
      property: jsonReport.property || (jsonReport.constraint && jsonReport.constraint.predicate),
      message: '',
      node: (jsonReport.triple && jsonReport.triple.subject) || parentNode || '',
      shape: parentShape,
      severity: 'error',
    };
    switch (jsonReport.type) {
      case 'TypeMismatch':
        failure.message = `Value provided for property ${failure.property} has an unexpected type`;
        this.simplify(jsonReport.errors, undefined, undefined);
        break;
      case 'MissingProperty':
        failure.message = `Property ${failure.property} not found`;
        break;
      case 'ExcessTripleViolation':
        failure.message = `Property ${failure.property} has a cardinality issue`;
        break;
      case 'BooleanSemActFailure':
        if (!jsonReport.ctx || !jsonReport.ctx.predicate) return;
        failure.message = `Property ${failure.property} failed semantic action ` +
          `with code js:'${jsonReport.code}'`;
        break;
      default:
        throw new errors.ShexValidationError(`Unknown failure type ${jsonReport.type}`);
    }
    this.failures.push(failure);
  }

  /**
   * Recursively parses ShExJ Shape structure to get the core Shape with properties
   * @param {LH.StructuredData.ShExShape} node
   * @returns {LH.StructuredData.ShExTargetShape | undefined}
   */
  getShapeCore(node) {
    if (node.type === 'Shape') {
      return node;
    }
    if (node.shapeExprs) {
      return node.shapeExprs
        .map(nestedStruct => this.getShapeCore(nestedStruct))
        .filter(nestedStruct => nestedStruct !== undefined)[0];
    }
  }

  /**
   * Gets annotations for specific property in shape from the ShExJ shape
   * @param {string} shape
   * @param {string} property
   * @returns {Map<string, string>}
   */
  getAnnotations(shape, property) {
    const mapper = new Map();
    const shapeObj = this.shapes.get(shape);
    if (!shapeObj) return mapper;
    const propStructure = shapeObj.expression.expressions
      .filter(x => x.predicate === property)[0];
    if (!propStructure || !propStructure.annotations) return mapper;
    propStructure.annotations.forEach(x => {
      mapper.set(x.predicate, x.object.value);
    });
    return mapper;
  }

  /**
   * Transforms a temporary report failures to structured data report failures
   * @returns {Array<LH.StructuredData.Failure>}
   */
  toStructuredDataReport() {
    return this.failures.map(err => {
      /** @type {LH.StructuredData.Failure} */
      const failure = {
        property: err.property,
        message: err.message,
        shape: err.shape,
        node: err.node,
        severity: 'error',
      };
      if (err.shape && err.property && this.annotations) {
        const shapeAnnotations = this.getAnnotations(err.shape, err.property);
        for (const [key, value] of Object.entries(this.annotations)) {
          const annotation = shapeAnnotations.get(value) || failure[key];
          if (annotation) failure[key] = annotation;
        }
      }
      return failure;
    });
  }
}

class ShexValidator {
  /**
   * @param {object|string} shapes - ShExJ shapes
   * @param {{[prop: string]: any}} options
   */
  constructor(shapes, options = {}) {
    if (typeof shapes === 'string') {
      this.shapes = shex.Parser.construct('', {}, {}).parse(shapes);
    } else {
      this.shapes = shapes;
    }
    this.annotations = options.annotations;
  }

  /**
   * Validates data against ShEx shapes
   * @param {string|LH.StructuredData.Store} data
   * @param {string} shape -  identifier of the target shape
   * @param {{ [prop: string]: any }} options
   * @returns {Promise<LH.StructuredData.Report>}
   */
  async validate(data, shape, options = {}) {
    const baseUrl = options.baseUrl || utils.dummyUrl();
    let quads;
    if (typeof data === 'string') {
      quads = await parser.stringToQuads(data, baseUrl);
    } else {
      quads = data;
    }

    const db = shex.Util.makeN3DB(quads);
    const validator = shex.Validator.construct(this.shapes);
    const errors = new ValidationReport(validator.validate(db, [{
      node: baseUrl,
      shape: shape,
    }]), this.shapes, this.annotations);
    return {
      baseUrl: baseUrl,
      store: quads,
      failures: errors.toStructuredDataReport(),
    };
  }
}

module.exports = {Validator: ShexValidator};
