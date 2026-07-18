'use strict';

const catalog = require('./catalog');
const { applyTemplate, applyTemplateById } = require('./apply-template');
const {
  classifyTemplate,
  extractFieldsForTemplate,
  structureWithTemplate,
} = require('./classify-extract');

module.exports = {
  ...catalog,
  applyTemplate,
  applyTemplateById,
  classifyTemplate,
  extractFieldsForTemplate,
  structureWithTemplate,
};
