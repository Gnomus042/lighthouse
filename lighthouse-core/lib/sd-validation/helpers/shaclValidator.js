'use strict';

const toReadableStream = require('to-readable-stream');

const fs = require('fs');
const path = require('path');

// TODO register modules
const rdf = require('rdf-ext');
const ParserN3 = require('@rdfjs/parser-n3');
const ParserJsonld = require('@rdfjs/parser-jsonld');
const SHACLValidator = require('rdf-validate-shacl');
const Namespace = require('@rdfjs/namespace');

const RDFS = Namespace('http://www.w3.org/2000/01/rdf-schema#');

const shaclShapes = fs.readFileSync(path.join(__dirname, '../assets/full.shacl'));
const shaclSubClasses = fs.readFileSync(path.join(__dirname, '../assets/subclasses.ttl'));

/**
 * Parce data from json-ld or turtle to triples
 * @param {string} data
 * @param {string} format
 */
async function loadDataset(data, format) {
  const stream = toReadableStream(data);
  format = format.toLowerCase();
  let parser;
  if (format === 'json-ld' || format === 'jsonld') {
    parser = new ParserJsonld({rdf});
  } else if (format === 'ttl' || format === 'turtle') {
    parser = new ParserN3({rdf});
  } else {
    throw 'Unknown data format provided';
  }
  return rdf.dataset().import(parser.import(stream));
}

/**
 * Parce annotations. Probably needs correction
 * @param {*} shapes
 * @param {*} predicate
 * @param {*} object
 */
function getAnnotation(shapes, predicate, object) {
  let res; // TODO correct this
  shapes.match(predicate, object, undefined).forEach(quad => {
    res = quad.object.value;
  });
  return res;
}

/**
 * Simplify severity
 * @param {*} severity
 * @return {
 *ring}
 */
function simplifySeverity(severity) {
  if (severity === 'http://www.w3.org/ns/shacl#Violation') return 'error';
  if (severity === 'http://www.w3.org/ns/shacl#Warning') return 'warning';
  return 'info';
}

/**
 * Validates shacl
 * @param {string} dataStr
 */
async function validateShacl(dataStr) {
  const subclasses = (await loadDataset(shaclSubClasses.toString(), 'ttl'))
    .match(undefined, RDFS('subClassOf'), undefined);
  const data = await loadDataset(dataStr, 'json-ld');
  const shapes = await loadDataset(shaclShapes.toString(), 'ttl');

  subclasses.forEach(quad => {
    data.add(quad);
  });

  const validator = new SHACLValidator(shapes, {rdf});
  const report = await validator.validate(data);

  return report.results.map(err => {
    return {
      property: err.path ? err.path.value : undefined,
      message: err.message.length > 0 ? err.message[0].value : undefined,
      url: getAnnotation(shapes, err.sourceShape, rdf.namedNode('http://schema.org/url')),
      description: getAnnotation(shapes, err.sourceShape, rdf.namedNode('http://schema.org/description')),
      severity: simplifySeverity(err.severity.value),
    };
  });
}

module.exports = {validate: validateShacl};
