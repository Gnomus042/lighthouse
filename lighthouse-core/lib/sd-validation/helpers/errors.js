'use strict';

class InvalidDataError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'InvalidDataError';
  }
}

class ShexValidationError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'ShexValidationError';
  }
}

module.exports = {
  InvalidDataError: InvalidDataError,
  ShexValidationError: ShexValidationError,
};
