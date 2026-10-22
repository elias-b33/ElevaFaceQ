import { describe,expect,it } from 'vitest';
import { FRONT_LANDMARKS } from '@freeharmony/engine';
import { MAPPING_ENGINE,observedFrontDocument } from './observed-mapping';

const mesh=Array.from({length:478},(_,i)=>({x:.3+(i%100)/500,y:.2+Math.floor(i/100)/20,z:0}));
describe('observed front mapping',()=>{
  it('uses actual source coordinates and original image dimensions',()=>{
    const original=JSON.stringify(mesh);
    const doc=observedFrontDocument({mesh,width:480,height:640,at:7});
    expect(doc.aspect).toBe(.75);expect(doc.imageHeight).toBe(640);
    expect(doc.automatic).toMatchObject({engine:MAPPING_ENGINE,detected:42,estimated:0,missing:11,at:7});
    for(const def of FRONT_LANDMARKS.filter(d=>d.mesh!==undefined&&!d.manual)){
      const indices=typeof def.mesh==='number'?[def.mesh]:def.mesh!;
      expect(doc.points[def.key].x).toBeCloseTo(indices.reduce((sum,i)=>sum+mesh[i].x,0)/indices.length);
      expect(doc.points[def.key].y).toBeCloseTo(indices.reduce((sum,i)=>sum+mesh[i].y,0)/indices.length);
      expect(doc.points[def.key].reviewed).toBe(false);
    }
    expect(JSON.stringify(mesh)).toBe(original);
  });
  it('does not invent a hairline, eyelid crease, hood, ear, neck or bridge edge',()=>{
    const doc=observedFrontDocument({mesh,width:1000,height:1250});
    for(const key of ['hairline','earL','earR','neckL','neckR','hoodL','hoodR','creaseL','creaseR','bridgeL','bridgeR']){
      expect(doc.points[key]).toMatchObject({source:'template',reviewed:false,confidence:0});
    }
  });
  it('keeps absent iris centers unplaced on the older topology',()=>{
    const doc=observedFrontDocument({mesh:mesh.slice(0,468),width:800,height:1000});
    expect(doc.points.pupilL.source).toBe('template');expect(doc.points.pupilR.source).toBe('template');
  });
  it('rejects corrupt topology and invalid dimensions without fabricating observations',()=>{
    for(const points of [mesh.slice(0,100),mesh.map((p,i)=>i===0?{...p,x:NaN}:p)]){
      const doc=observedFrontDocument({mesh:points,width:480,height:640});
      expect(doc.automatic?.detected).toBe(0);expect(doc.automatic?.meshFound).toBe(false);
    }
    expect(()=>observedFrontDocument({mesh,width:0,height:640})).toThrow();
  });
});
