/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';


const Audit = require('../audit.js');
const i18n = require('../../lib/i18n/i18n.js');
const validator = require('../../lib/sd-validation/schema-validator.js');

const UIStrings = {
  title: 'Structured data is valid',
  failureTitle: 'Structured data is not valid',
  description: 'description here',

  propertyHeader: 'Property',
  severityHeader: 'Severity',
  causeHeader: 'Cause',
  tagHeader: 'Tag',

  shexHeader: 'shex',
  shaclHeader: 'shacl',
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
      requiredArtifacts: ['ScriptElements'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts) {
    const receipesData = artifacts.ScriptElements.filter(x => x.type === 'application/ld+json' && x.content !== null)[0].content;
    const report = await validator(receipesData);

    const errorsCount = report.filter(x => x.severity === 'error').length;
    const warningsCount = report.filter(x => x.severity === 'warning').length;
    let score = (100 - errorsCount * 10 - warningsCount * 5) / 100.0;
    score = score > 0.02 ? score : 0.02; // making the default value

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'service', itemType: 'text', text: str_(UIStrings.tagHeader)},
      {key: 'property', itemType: 'text', text: str_(UIStrings.propertyHeader)},
      {key: 'severity', itemType: 'text', text: str_(UIStrings.severityHeader)},
      {key: 'message', itemType: 'text', text: str_(UIStrings.causeHeader)},
    ];

    const details = Audit.makeTableDetails(headings, report);
    return {
      score: score,
      details,
    };
  }
}

module.exports = StructuredData;
module.exports.UIStrings = UIStrings;
