/*!
 * Copyright (c) 2018-2019 Veres One Project. All rights reserved.
 */
'use strict';

const constants = require('./constants');
const documentLoader = require('./documentLoader');

const Cosmos = require('./Cosmos');

module.exports = {
  constants,
  documentLoader,
  Cosmos,
  driver: options => {
    return new Cosmos(options);
  },
  CosmosClient: require('./CosmosClient'),
  CosmosDidDoc: require('./CosmosDidDoc')
};
