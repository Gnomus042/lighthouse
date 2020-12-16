/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env jest */

const assert = require('assert').strict;
const syntaxChecker = require('../../lib/sd-validation/syntax-checker.js');
const ShexValidator = require('../../lib/sd-validation/helpers/shex-validator.js').Validator;

/* Syntax checkers tests */

describe('Syntax checks', () => {
  it('fails if json is missing closing bracket', async () => {
    const error = syntaxChecker.checkJSON(`{
      "test": "test"
    `);

    assert.strictEqual(error.lineNumber, 2);
    assert.ok(error.message.indexOf(`Expecting '}'`) === 0);
  });

  it('fails if json is missing comma', async () => {
    const error = syntaxChecker.checkJSON(`{
      "test": "test"
      "test2": "test2"
    }`);

    assert.strictEqual(error.lineNumber, 2);
    assert.ok(error.message.indexOf(`Expecting 'EOF', '}', ':', ',', ']'`) === 0);
  });

  it('passes valid json', async () => {
    const error = syntaxChecker.checkJSON(`{
      "test": "test",
      "test2": {
        "test2-1": "test",
        "test2-2": "test2"
      },
      "test3": null,
"test4": 123,
      "test5": [1,2,3]
    }`);

    assert.strictEqual(error, null);
  });

  it('passes valid microdata', async () => {
    const error = await syntaxChecker.checkMicrodata(`
      <div itemscope itemtype="https://schema.org/Person">
        <span itemprop="name"/>Jane Doe</span>
        <img src="janedoe.jpg" itemprop="image" alt="Photo of Jane Doe"/>
        <span itemprop="jobTitle">Professor</span>
      </div>`, 'http://example.org/');
    assert.strictEqual(error, null);
  });

  it('passes valid RDFa', async () => {
    const error = await syntaxChecker.checkRDFa(`
      <div vocab="https://schema.org/" typeof="Person">
        <span property="name">Jane Doe</span>
        <img src="janedoe.jpg" property="image" alt="Photo of Jane Doe"/>
        <span property="jobTitle">Professor</span>
      </div>`, 'http://example.org/');
    assert.strictEqual(error, null);
  });
});

describe('ShEx validation', () => {
  const shapes = `
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    BASE <https://schema.org/validation>

    <#Thing> {
        schema:name Literal
        // rdfs:comment "Name is required for SomeProduct";
        schema:description Literal
        // rdfs:comment "Description is required for SomeProduct"
        // rdfs:label "warning";
        schema:identifier /GTIN|UUID|ISBN/ *
        // rdfs:label "warning";
    }

    <#CreativeWork> @<#Thing> AND {
        schema:text Literal ;
    }
  `;
  const validator = new ShexValidator(shapes);

  it('fails if some property is missing', async () => {
    const data = `{
      "@context": "http://schema.org/",
      "@type": "Thing",
      "description": "test1-description"
    }`;
    const errors = (await validator.validate(data, 'https://schema.org/validation#Thing', {baseUrl: 'http://example.org/'})).failures;

    assert.strictEqual(errors.length, 1);
    assert.deepEqual(errors, [
      {
        property: 'http://schema.org/name',
        message: 'Property http://schema.org/name not found',
        shape: 'https://schema.org/validation#Thing',
        node: 'http://example.org/',
        severity: 'error',
      },
    ]);
  });

  it('passes if the data has all required properties', async () => {
    const data = `{
      "@context": "http://schema.org/",
      "@type": "Thing",
      "description": "test1-description",
      "name": "test1"
    }`;
    const errors = (await validator.validate(data, 'https://schema.org/validation#Thing', {baseUrl: 'http://example.org/'})).failures;
    assert.strictEqual(errors.length, 0);
  });

  it('fails if regex check is failing', async () => {
    const data = `{
      "@context": "https://schema.org/",
      "@type": "Thing",
      "name": "test1",
      "description": "test1-description",
      "identifier": "AAAA"
    }`;
    const errors = (await validator.validate(data, 'https://schema.org/validation#Thing', {baseUrl: 'http://example.org/'})).failures;
    assert.strictEqual(errors.length, 1);
    assert.deepEqual(errors, [
      {
        property: 'http://schema.org/identifier',
        message: 'Value provided for property http://schema.org/identifier has an unexpected type',
        shape: 'https://schema.org/validation#Thing',
        node: 'http://example.org/',
        severity: 'error',
      },
    ]);
  });

  it('fails if some required property is missing and regex check is failing', async () => {
    const data = `{
      "@context": "https://schema.org/",
      "@type": "Thing",
      "name": "test1",
      "identifier": "AAAA"
    }`;
    const errors = (await validator.validate(data, 'https://schema.org/validation#Thing', {baseUrl: 'http://example.org/'})).failures;
    assert.strictEqual(errors.length, 2);
    assert.deepEqual(errors, [
      {
        property: 'http://schema.org/identifier',
        message: 'Value provided for property http://schema.org/identifier has an unexpected type',
        shape: 'https://schema.org/validation#Thing',
        node: 'http://example.org/',
        severity: 'error',
      },
      {
        property: 'http://schema.org/description',
        message: 'Property http://schema.org/description not found',
        shape: 'https://schema.org/validation#Thing',
        node: 'http://example.org/',
        severity: 'error',
      },
    ]);
  });

  it('should add annotations if they are defined', async () => {
    const data = `{
      "@context": "https://schema.org/",
      "@type": "Thing",
      "name": "test1",
      "identifier": "AAAA"
    }`;
    const annotations = {
      description: 'http://www.w3.org/2000/01/rdf-schema#comment',
      severity: 'http://www.w3.org/2000/01/rdf-schema#label',
    };
    const annotatedValidator = new ShexValidator(shapes, {annotations: annotations});
    const errors = (await annotatedValidator.validate(data, 'https://schema.org/validation#Thing', {baseUrl: 'http://example.org/'})).failures;
    assert.strictEqual(errors.length, 2);
    assert.deepEqual(errors, [
      {
        property: 'http://schema.org/identifier',
        message: 'Value provided for property http://schema.org/identifier has an unexpected type',
        shape: 'https://schema.org/validation#Thing',
        node: 'http://example.org/',
        severity: 'warning',
      },
      {
        property: 'http://schema.org/description',
        message: 'Property http://schema.org/description not found',
        shape: 'https://schema.org/validation#Thing',
        node: 'http://example.org/',
        severity: 'warning',
        description: 'Description is required for SomeProduct',
      },
    ]);
  });

  it('should include failures from parent classes', async () => {
    const data = `{
      "@context": "http://schema.org/",
      "@type": "CreativeWork",
      "description": "test1-description"
    }`;
    const errors = (await validator.validate(data, 'https://schema.org/validation#Thing', {baseUrl: 'http://example.org/'})).failures;
    assert.strictEqual(errors.length, 1);
    assert.deepEqual(errors, [
      {
        property: 'http://schema.org/name',
        message: 'Property http://schema.org/name not found',
        shape: 'https://schema.org/validation#Thing',
        node: 'http://example.org/',
        severity: 'error',
      },
    ]);
  });
});
