/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';


const Audit = require('../audit.js');
const i18n = require('../../lib/i18n/i18n.js');
const validator = require('../../lib/sd-validation/shex-schema-validator.js');
const syntaxChecker = require('../../lib/sd-validation/syntax-checker.js');
const utils = require('../../lib/sd-validation/helpers/utils.js');

const UIStrings = {
  title: 'Structured data is valid',
  failureTitle: 'Structured data is not valid',
  description: 'The audit provides a short list of improvements that could be done to the structured data on the tested webpage. To get a detailed validation report run the [Rich Results Test](https://search.google.com/test/rich-results) or the [Structured Data Linter](http://linter.structured-data.org/). [Learn more](https://web.dev/structured-data/).',
  emptyHeader: '',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

class StructuredData extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'link-text',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['ScriptElements', 'MainDocumentContent', 'URL'],
    };
  }

  /**
   * Reformat validation failures array to Lighthouse table form
   * @param {Array<LH.StructuredData.Failure>} report
   * @returns {*}
   */
  static reportToTable(report) {
    report.forEach(element => {
      if (element.message) element.message = utils.removeUrls(element.message);
      if (element.property) element.property = utils.removeUrls(element.property);
      element.node = utils.removeUrls(element.node);
      element.message = `${element.message}. ${element.description || ''}`;
      element.url = {
        type: 'link',
        text: 'Learn more',
        url: element.url,
      };
    });
    /**
     * @param {{[propName: string]: Array<LH.StructuredData.Failure>}} res
     * @param {LH.StructuredData.Failure} reportItem
     */
    const groupBy = (res, reportItem) => {
      res[reportItem.node] = [...res[reportItem.node] || [], reportItem];
      return res;
    };
    const groupedByNode = report.reduce(groupBy, {});
    const items = [];
    for (const [key, value] of Object.entries(groupedByNode)) {
      if (key === '') {
        items.push(value);
      } else {
        const item = {
          property: key,
          subItems: {
            items: value,
          },
        };
        items.push(item);
      }
    }
    return items;
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts) {
    const data = [];
    /** @type {Array<LH.StructuredData.Failure>} */
    const report = [];
    for (const scriptElement of artifacts.ScriptElements) {
      if (scriptElement.type === 'application/ld+json' && scriptElement.content) {
        const jsonSyntaxCheck = syntaxChecker.checkJSON(scriptElement.content);
        if (jsonSyntaxCheck) {
          report.push({
            message: jsonSyntaxCheck.message,
            severity: 'error',
            node: '',
          });
        } else {
          data.push(scriptElement.content);
        }
      }
    }

    const htmlSyntaxCheck = await syntaxChecker.checkMicrodata(artifacts.MainDocumentContent,
      artifacts.URL.finalUrl) || await syntaxChecker.checkRDFa(artifacts.MainDocumentContent,
      artifacts.URL.finalUrl);
    if (htmlSyntaxCheck) {
      report.push({
        message: htmlSyntaxCheck.message,
        severity: 'error',
        node: '',
      });
    } else {
      data.push(artifacts.MainDocumentContent);
    }
    const validationFailures = await validator(data, artifacts.URL.finalUrl);
    if (validationFailures.length > 0) report.push(...validationFailures);
    const errorsCount = report.filter(x => x.severity === 'error').length;
    const warningsCount = report.filter(x => x.severity === 'warning').length;
    let score = (100 - errorsCount * 10 - warningsCount * 5) / 100.0;
    score = score > 0.01 ? score : 0.01; // default value for even very bad markup should be 1%

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'property', itemType: 'text', subItemsHeading: {key: 'property'}, text: ''},
      {key: 'message', itemType: 'text', subItemsHeading: {key: 'message'}, text: ''},
      {key: 'url', itemType: 'link', subItemsHeading: {key: 'url'}, text: ''},
      {key: 'service', itemType: 'text', subItemsHeading: {key: 'service'}, text: ''},
      {key: 'severity', itemType: 'text', subItemsHeading: {key: 'severity'}, text: ''},
    ];

    const items = StructuredData.reportToTable(report);
    const details = Audit.makeTableDetails(headings, items);

    return {
      score: score,
      details,
    };
  }
}

module.exports = StructuredData;
module.exports.UIStrings = UIStrings;
