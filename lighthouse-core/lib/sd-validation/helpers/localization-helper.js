/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const errors = require('./errors.js');

const DEFAULT_LOCALE = 'en';

/**
 * Gets annotations localization for a given locale
 * @param {string|undefined} locale
 * @returns {LH.StructuredData.LocalizedAnnotations}
 */
function getAnnotations(locale = undefined) {
  locale = locale || DEFAULT_LOCALE;
  const annotationsPath = path.join(__dirname, '..', 'assets', 'localization',
    'annotations', `${locale}.json`);
  if (!fs.existsSync(annotationsPath)) {
    throw new errors.LocalizationError(
      `Annotations localization is not defined for locale ${locale}`);
  }
  return JSON.parse(fs.readFileSync(annotationsPath).toString());
}

/**
 * Get messages localization for a given locale
 * @param {string|undefined} locale
 * @returns {LH.StructuredData.LocalizedMessages}
 */
function getMessages(locale = undefined) {
  locale = locale || DEFAULT_LOCALE;
  const messagesPath = path.join(__dirname, '..', 'assets', 'localization',
    'messages', `${locale}.json`);
  if (!fs.existsSync(messagesPath)) {
    throw new errors.LocalizationError(
      `Messages localization is not defined for locale ${locale}`);
  }
  return JSON.parse(fs.readFileSync(messagesPath).toString());
}

module.exports = {
  getAnnotations: getAnnotations,
  getMessages: getMessages,
};
