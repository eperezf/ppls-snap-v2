'use strict';

import { handler } from './index.mjs';
const event = {}
const context = {}
const result = await handler(event, context)