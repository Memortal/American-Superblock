import assert from 'node:assert/strict';
import {createResidentialPrivacyBuffers} from '../public/privacy-protection.js';
const building={id:'B',outer:[[0,0],[100,0],[100,100],[0,100]]};
const piece={id:'B-1',building:'B',kind:'outer-wing',groundPolygon:[[12,4],[88,4],[88,23],[12,23]]};
const empty=createResidentialPrivacyBuffers([building],[piece]);
assert(empty.elements.length>0,'street-facing recessed homes should be screened');
assert(empty.report.protectedUnits===1);
const blocked=createResidentialPrivacyBuffers([building],[piece],[{position:[50,0],normal:[0,1],airlockDepth:12,canopyDepth:12,width:120}]);
assert(blocked.report.skippedEntranceModules>0,'entrance approach protected');
assert(blocked.elements.length===0,'a full frontage entrance exclusion must avoid obstacles');
for(const e of empty.elements)for(const part of e.parts)for(const pt of part.polygon){assert(pt[1]>=-.1&&pt[1]<=4.1,'buffer remains inside recessed band');}
console.log('privacy-protection: passed');
