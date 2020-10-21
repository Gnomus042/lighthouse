'use strict';

const Store = require('n3').Store;

const namespace = require('rdflib').Namespace;
const rdf = namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

/**
 * Removes duplicates from objects array
 * @param {Array<{[prop:string]: any}>} items
 * @param {string[]} keys
 * @returns {*}
 */
function uniqueBy(items, keys) {
  /** @type {{[prop:string]: any}} */
  const seen = {};
  return items.filter(function(item) {
    let val = '';
    keys.forEach(key => val += item[key]);
    return seen.hasOwnProperty(val) ? false : (seen[val] = true);
  });
}

/**
 *  Generates random URL as base
 *  @param {number} length
 *  @return {string}
 */
function dummyUrl(length = 16) {
  let result = 'https://example.org/';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Parses quads to multiple stores, one for each typed shape
 * @param {Store} store
 */
function quadsToShapes(store) {
  const typesQuads = store.getQuads(undefined, rdf('type'), undefined);
  const rootShapesIds = [];
  for (const quad of typesQuads) {
    let dependent = false;
    for (const subQuad of typesQuads) {
      // if there is a node, that has current subject nested inside it,
      // then it is not root
      if (store.getQuads(subQuad.subject.id, undefined, quad.subject.id).length > 0 &&
        subQuad.subject.id !== quad.subject.id) {
        dependent = true;
        break;
      }
    }
    if (!dependent) {
      rootShapesIds.push(quad.subject);
    }
  }
  const shapes = new Map();
  for (const id of rootShapesIds) {
    shapes.set(id, getShape(id, store, shapes, []));
  }
  return shapes;
}

/**
 * Recursively gets all triples, related to the shape
 * @param {any} id - id of the constructed shape
 * @param {Store} store - store, containing all the triples
 * @param {Map<any, Store>} shapes - map [id -> shape Store]
 * @param {Array<any>} parsed - array for tracking recursive loops
 */
function getShape(id, store, shapes, parsed) {
  parsed.push(id.id);
  const shapeQuads = store.getQuads(id, undefined, undefined);
  if (shapeQuads.length === 0) return;
  for (const quad of store.getQuads(id, undefined, undefined)) {
    if (parsed.includes(quad.object.id)) continue;
    let nestedStore;
    if (shapes.get(quad.object)) {
      nestedStore = shapes.get(quad.object);
    } else {
      nestedStore = getShape(quad.object, store, shapes, parsed);
    }
    if (nestedStore && nestedStore.getQuads().length > 0) {
      shapeQuads.push(...nestedStore.getQuads());
    }
  }
  const shapeStore = new Store();
  for (const quad of shapeQuads) {
    shapeStore.addQuad(quad);
  }
  return shapeStore;
}

/**
 * Removes all url-like substrings for the given string
 * @param {string} text
 */
function removeUrls(text) {
  const urlRegexp = /https?:\/\/[^\s]+[/#]/g;
  while (text.match(urlRegexp)) {
    text = text.replace(urlRegexp, '');
  }
  return text;
}

module.exports = {
  dummyUrl: dummyUrl,
  removeUrls: removeUrls,
  uniqueBy: uniqueBy,
  quadsToShapes: quadsToShapes,
};
