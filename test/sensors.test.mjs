import assert from 'node:assert/strict';
import test from 'node:test';
import {sensorMatch} from '../src/jsEditorSensors.js';
test('sensor thresholds use strict comparisons, reject bad readings and rearm beyond hysteresis',()=>{
 assert.equal(sensorMatch(-1,'<',100),false);assert.equal(sensorMatch(-2,'>',100),false);
 assert.equal(sensorMatch(NaN,'<',100),false);
 assert.equal(sensorMatch(99,'<',100),true);assert.equal(sensorMatch(100,'<',100),false);
 assert.equal(sensorMatch(101,'>',100),true);assert.equal(sensorMatch(100,'>',100),false);
 assert.equal(sensorMatch(102,'<',100,true),false);assert.equal(sensorMatch(105,'<',100,true),true);
 assert.equal(sensorMatch(0,'>',0,true),true);
 assert.equal(sensorMatch(98,'>',100,true),false);assert.equal(sensorMatch(95,'>',100,true),true);
});
